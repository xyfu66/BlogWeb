---
title: "上下文窗口管理与截断防御：Token 经济学、滑窗合并与断点续传"
date: "2026-08-30"
tags: ["Token管理", "上下文窗口", "截断续传", "MapReduce", "Java 21"]
slug: "enterprise-ai-ocr-part-7-context-window-truncation"
part: 7
summary: "系统性剖析大模型视觉与文本处理中的物理边界约束与工程应对策略：详解视觉 Token 预算分配与 Payload 优化、基于 Java 21 虚拟线程的多页超长文档 Map-Reduce 并发提取流水线、输出截断（stop_reason=max_tokens）的自动嗅探与断点续传（Continuation Prompting）无缝缝合算法，以及跨页表格的滑窗消重归约。"
---

# 上下文窗口管理与截断防御：Token 经济学、滑窗合并与断点续传

在将多模态大模型应用于企业级长文档处理时，工程师经常会遭遇两堵“物理高墙”：
1. **输入端限制（Input Limits）**：超长文档（如数十页合同或上百页报表）若一次性传入全部高清图片，会瞬间打爆模型的输入上下文窗口或触发云服务商单次请求 Payload 上限（如 AWS Bedrock 25MB 限制），并产生惊人的 Token 账单；
2. **输出端截断（Output Truncation）**：主流模型在单次生成中均有硬性最大输出 Token 限制（如 4096 或 8192 Tokens）。当文档中包含成百上千条明细行时，模型输出的 JSON 会在某个中途突然“腰斩截断”，导致整体 JSON 语法损坏、反序列化彻底崩溃。

如何构建一套兼具 **成本经济性** 与 **防截断韧性** 的上下文管理中枢？本文将系统解构长文档的分块提取、滑窗合并与断点续传工程实现。

---

## 1. 大模型物理约束与 Token 预算分配（Token Budgeting）

为了保证流水线稳定运行，系统必须对每一次模型调用的 Token 配额进行严格的**预算预估与分配**：

```mermaid
flowchart LR
    subgraph Budget["单次请求 Token 预算分配模型 (以 8K 上下文为例)"]
        direction TB
        SP["System Prompt 基础约束 (~800 Tokens)"]
        Schema["Tool Calling JSON Schema 契约 (~1,200 Tokens)"]
        Images["视觉图像/切片 Patch (~3,000 Tokens)"]
        Reserved["预留模型输出空间 Max Output (3,000 Tokens)"]
        
        SP --- Schema --- Images --- Reserved
    end
```

### 1.1 图像 Token 开销估算模型
在主流视觉 Transformer（ViT）中，单张图像消耗的 Token 数与图像分辨率直接挂钩：
$$\text{Tokens}_{image} = \left\lceil \frac{W}{28} \right\rceil \times \left\lceil \frac{H}{28} \right\rceil + \text{Base Overhead}$$

一张 $1024 \times 1024$ 的局部切片约消耗 **1,600 Tokens**。因此，单次请求绝不能盲目叠加超过 4 张高清切片，必须实施**分页分块调度**。

---

## 2. 超长文档的 Map-Reduce 并发提取流水线

对于多达数十页的长篇文档，采用 **Map-Reduce 范式** 配合 Java 21 虚拟线程：

```mermaid
flowchart TD
    LongDoc["20 页超长企业文档"] --> Splitter["智能分页滑窗切分器 (Sliding Window: 2 页/Chunk, 重叠 1 页)"]
    
    Splitter --> Chunk1["Batch 1: Page 1-2"]
    Splitter --> Chunk2["Batch 2: Page 2-3"]
    Splitter --> ChunkN["Batch N: Page 19-20"]
    
    Chunk1 --> Map1["Map: VLM 提取 (Virtual Thread 1)"]
    Chunk2 --> Map2["Map: VLM 提取 (Virtual Thread 2)"]
    ChunkN --> MapN["Map: VLM 提取 (Virtual Thread N)"]
    
    Map1 & Map2 & MapN --> Reducer["Reduce: 语义归约器 (Schema Reducer)"]
    
    subgraph ReducerLogic["归约消重逻辑"]
        R1["1. 跨页重复表头消重"]
        R2["2. 明细行数组 (items) 顺序追加拼接"]
        R3["3. 汇总字段 (Totals) 跨页一致性校验"]
    end
    
    Reducer --> ReducerLogic
    ReducerLogic --> FinalJSON["最终全局单据统一 JSON"]
```

---

## 3. 输出截断自动检测与断点续传（Continuation Prompting）

### 3.1 截断现象与状态检测
当模型生成的结构化数据量超出 `max_tokens` 时，Bedrock 返回的响应中 `stop_reason` 会被标记为 `"max_tokens"` 而非正常结束的 `"end_turn"` 或 `"tool_use"`。

此时返回的字符串通常在中间断裂（例如 `{"item_id": 89, "price": 12`）。直接解析会抛出 `JsonParseException: Unexpected end-of-input`。

```mermaid
sequenceDiagram
    autonumber
    participant Engine as Java 21 调度引擎
    participant Bedrock as AWS Bedrock (Claude 3.5)
    
    Engine->>Bedrock: 发起初始提取请求 (Page 1-5 明细)
    Bedrock-->>Engine: 返回部分结果 (stop_reason = "max_tokens", 生成在第 50 行截断)
    
    Note over Engine: 探测到截断信号！解析已提取成功的最后一条完整对象 (ID=48)
    
    Engine->>Bedrock: 发起断点续传请求 ("已成功提取至第48项，请紧接第49项继续提取...")
    Bedrock-->>Engine: 返回后续结果 (stop_reason = "end_turn")
    
    Note over Engine: 数组智能缝合 (Array Splice & Merge)
    Engine->>Engine: 输出 100% 完整结构化 JSON
```

### 3.2 截断自动恢复与续传实现

```java
package com.idp.engine.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class TruncationRecoveryManager {

    private static final Logger log = LoggerFactory.getLogger(TruncationRecoveryManager.class);
    private static final String STOP_REASON_MAX_TOKENS = "max_tokens";

    private final ObjectMapper objectMapper;

    public TruncationRecoveryManager(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 判断响应是否发生输出截断
     */
    public boolean isTruncated(String stopReason) {
        return STOP_REASON_MAX_TOKENS.equalsIgnoreCase(stopReason);
    }

    /**
     * 构建断点续传提示词
     */
    public String buildContinuationPrompt(int lastExtractedIndex, String lastItemKey) {
        return String.format(
            "上一次输出因达到 Token 上限截断。当前已完整解析至第 %d 项（标识键：%s）。" +
            "请严格紧接该项之后，继续提取剩余未完成的明细项，并保持相同的 JSON Schema 结构。",
            lastExtractedIndex, lastItemKey
        );
    }

    /**
     * 将两段截断数据平滑缝合
     */
    public JsonNode stitchTruncatedArrays(JsonNode primaryPart, JsonNode continuationPart, String arrayFieldName) {
        if (!primaryPart.has(arrayFieldName) || !continuationPart.has(arrayFieldName)) {
            return primaryPart;
        }

        ObjectNode mergedRoot = primaryPart.deepCopy();
        ArrayNode targetArray = (ArrayNode) mergedRoot.get(arrayFieldName);
        ArrayNode continuationArray = (ArrayNode) continuationPart.get(arrayFieldName);

        for (JsonNode item : continuationArray) {
            targetArray.add(item);
        }

        log.info("成功缝合截断数组: 原有 {} 项 + 续传 {} 项 = 共 {} 项", 
                 primaryPart.get(arrayFieldName).size(), continuationArray.size(), targetArray.size());

        return mergedRoot;
    }
}
```

---

## 4. 滑窗消重与全局汇总归约算法

在进行相邻页面滑窗（如 Window 1: Page 1-2, Window 2: Page 2-3）时，Page 2 的数据会被重复提取两次。系统通过**唯一业务主键指纹（Composite Business Key）**在 Reduce 阶段进行自动去重：

```java
package com.idp.engine.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class SlidingWindowArrayDeduplicator {

    /**
     * 基于组合指纹对滑窗提取的重叠子项进行精准消重
     */
    public ArrayNode deduplicateItems(List<JsonNode> windowItemArrays, List<String> uniqueKeyFields) {
        ArrayNode unifiedArray = JsonNodeFactory.instance.arrayNode();
        Set<String> seenFingerprints = new HashSet<>();

        for (JsonNode arrayNode : windowItemArrays) {
            if (arrayNode == null || !arrayNode.isArray()) continue;

            for (JsonNode item : arrayNode) {
                String fingerprint = buildFingerprint(item, uniqueKeyFields);
                if (seenFingerprints.add(fingerprint)) {
                    unifiedArray.add(item);
                }
            }
        }

        return unifiedArray;
    }

    private String buildFingerprint(JsonNode item, List<String> uniqueKeyFields) {
        StringBuilder sb = new StringBuilder();
        for (String field : uniqueKeyFields) {
            sb.append(item.path(field).asText("")).append("||");
        }
        return sb.toString();
    }
}
```

---

## 5. 小结与下篇预告

通过构建 **Token 预算管理、Map-Reduce 分页提取、截断自动感知续传与滑窗消重归约**，系统彻底攻克了大模型在处理数十页超长文档时的物理限制，保证了 100% 的数据完整度与吞吐可用性。

现在，我们已经具备了从长文档中稳定抽取完整数据的能力。但在实际业务中，大模型提取的数据是否绝对正确？如果出现金额微小偏差，系统如何感知并自愈？

在下一篇文章 **《Agentic 校验闭环：可信规则引擎、自我反思纠错（Self-Correction）与置信度量化》** 中，我们将深入剖析智能体的自我反思自愈（Reflection Loop）机制！
