---
title: "高可用防御性架构：Resilience4j 熔断降级实战与 AWS CloudFormation / ECS 交付"
date: "2026-08-30"
tags: ["Resilience4j", "高可用", "AWS Fargate", "CloudFormation", "DevOps"]
slug: "enterprise-ai-ocr-part-10-resilience4j-cloud-iac"
part: 10
summary: "全面复盘企业级 IDP 系统的生产级韧性架构与云原生部署交付：深入配置 Resilience4j 熔断器、限流器、重试与隔离舱组合防线以应对外部大模型 API 抖动，详解 S3 预签名 URL 安全分发，并给出基于 AWS CloudFormation (IaC) 与 ECS Fargate 的自动化部署实战。"
---

# 高可用防御性架构：Resilience4j 熔断降级实战与 AWS CloudFormation / ECS 交付

在任何将生成式 AI（Generative AI）深度集成到核心业务流的系统中，外部大模型 API 都是最大的 **“不确定性来源”**。

面对大模型 API 的**偶发性限流（HTTP 429 Too Many Requests）、推理超时抖动、上游服务降级（HTTP 503）**，如果后端直接裸调接口，瞬间的高并发流量极易引发级联故障（Cascading Failure），导致整个系统服务雪崩。

本文将深入生产高可用实战，解密如何利用 **Resilience4j** 构筑钢铁般的防御性防线，并通过 **AWS CloudFormation (IaC) + ECS Fargate** 完成云原生交付。

---

## 1. 对抗大模型 API 不确定性的四重防御阵线

我们基于 **Resilience4j** 构建了层层递进的四重容错机制：

```mermaid
flowchart TD
    Request["文档识别请求 (Java 21 虚拟线程)"] --> Bulkhead["1. 隔离舱 (Bulkhead) - 限制最大并发调用数"]
    Bulkhead --> RateLimiter["2. 限流器 (RateLimiter) - 平滑请求削峰，匹配 Bedrock 配额"]
    RateLimiter --> CircuitBreaker["3. 熔断器 (CircuitBreaker) - 监控错误率与慢调用，快速切断故障"]
    CircuitBreaker --> Retry["4. 重试机制 (Retry with Exponential Backoff) - 指数退避重试"]
    Retry --> BedrockAPI["AWS Bedrock (Claude 3.5 Sonnet)"]
    
    CircuitBreaker -.->|状态为 OPEN 触发熔断| Fallback["优雅降级处理器 (Fallback)"]
    Retry -.->|重试耗尽仍然失败| Fallback
    Fallback --> DLQ["存入异步延迟队列 / 标记待人工补录"]
```

---

## 2. Spring Boot 3.5 + Resilience4j 生产级配置调优

在 `application.yml` 中进行细粒度参数调优，实现慢调用熔断、指数退避抖动与并发隔离：

```yaml
resilience4j:
  circuitbreaker:
    instances:
      bedrockOcr:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 20                  # 滑动窗口样本量
        minimum-number-of-calls: 10              # 计算错误率的最小调用数
        failure-rate-threshold: 50.0             # 失败率达到 50% 立即触发熔断
        slow-call-rate-threshold: 70.0           # 慢调用率达到 70% 触发熔断
        slow-call-duration-threshold: 8000ms     # 超过 8 秒视为慢调用
        wait-duration-in-open-state: 30000ms     # 熔断开启后等待 30 秒进入半开状态
        permitted-number-of-calls-in-half-open-state: 5
        automatic-transition-from-open-to-half-open-enabled: true
  ratelimiter:
    instances:
      bedrockOcr:
        limit-for-period: 50                     # 每周期允许的最大请求数 (对齐 AWS Bedrock 配额)
        limit-refresh-period: 1s                 # 配额刷新周期
        timeout-duration: 5000ms                 # 排队等待超时时间
  retry:
    instances:
      bedrockOcr:
        max-attempts: 3                          # 最大重试 3 次
        wait-duration: 1500ms                    # 初始重试间隔
        enable-exponential-backoff: true         # 开启指数退避 (1.5s, 3s, 6s)
        exponential-backoff-multiplier: 2.0
        randomize-wait-factor: 0.5               # 注入随机抖动 (Jitter)，防止惊群效应
        retry-exceptions:
          - software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException
          - software.amazon.awssdk.core.exception.ApiCallTimeoutException
  bulkhead:
    instances:
      bedrockOcr:
        max-concurrent-calls: 30                 # 隔离舱最大并发数，保护本地内存
        max-wait-duration: 2000ms
```

---

## 3. S3 预签名 URL（Presigned URL）安全流转设计

为了保证企业敏感单据的安全性，前端**绝不直接持有长期有效的 AWS AccessKey**，也不通过后端应用服务器反复中转巨大的 PDF 二进制流：
1. **上传阶段**：后端生成有效时间为 15 分钟的 `S3 PUT Presigned URL`，前端直传 S3；
2. **审查阶段**：审查员打开 Vue 3 工作台时，后端动态签发仅当前用户可访问的 `S3 GET Presigned URL`（有效期 5 分钟），利用浏览器原生安全沙箱直接从 S3 CDN 边沿拉取渲染。

```mermaid
sequenceDiagram
    autonumber
    participant Frontend as Vue 3 前端
    participant Backend as Spring Boot 后端
    participant S3 as AWS S3 存储桶
    
    Frontend->>Backend: 请求上传凭证 (携带文档元数据)
    Backend->>Backend: 校验用户权限，生成 S3 Put Presigned URL
    Backend-->>Frontend: 返回 15 分钟临时上传 URL
    Frontend->>S3: HTTP PUT 直传文档二进制流 (绕过后端中转，节省带宽)
    S3-->>Frontend: 上传完成 (200 OK)
    Frontend->>Backend: 通知文档上传完成，触发异步 AI 抽取
```

---

## 4. 云原生交付：AWS CloudFormation (IaC) 与 ECS Fargate

为了实现“基础设施即代码（IaC）”与可复现的自动化交付，我们使用 **AWS CloudFormation** 编排整个微服务集群。

### 4.1 ECS Fargate Task Definition 核心模板片段

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'IDP Intelligent Document Processing - Production ECS Fargate Stack'

Resources:
  # 1. ECS 无服务器集群
  IdpEcsCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: idp-production-cluster
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT

  # 2. 任务执行角色 (Task IAM Role)
  IdpTaskExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  # 3. 业务运行角色 (授权访问 Bedrock 与 S3)
  IdpTaskAppRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: IdpBedrockS3Access
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action:
                  - bedrock:InvokeModel
                  - bedrock:InvokeModelWithResponseStream
                Resource: '*'
              - Effect: Allow
                Action:
                  - s3:GetObject
                  - s3:PutObject
                Resource: 'arn:aws:s3:::idp-production-docs/*'

  # 4. Fargate 任务定义
  IdpBackendTaskDef:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: idp-backend-service
      Cpu: '2048'          # 2 vCPU
      Memory: '4096'       # 4 GB
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      ExecutionRoleArn: !GetAtt IdpTaskExecutionRole.Arn
      TaskRoleArn: !GetAtt IdpTaskAppRole.Arn
      ContainerDefinitions:
        - Name: idp-backend
          Image: !Sub '${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/idp-backend:latest'
          Essential: true
          PortMappings:
            - ContainerPort: 8080
          Environment:
            - Name: SPRING_PROFILES_ACTIVE
              Value: prod
            - Name: JAVA_TOOL_OPTIONS
              Value: '-XX:+UseZGC -XX:+ZGenerational'  # 启用 Java 21 分代 ZGC 保证极低停顿
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: /ecs/idp-backend
              awslogs-region: !Ref 'AWS::Region'
              awslogs-stream-prefix: ecs
```

---

## 5. 小结与下篇预告

通过构筑 **Resilience4j 四重容错防线**、**S3 预签名零中转安全流转** 与 **AWS CloudFormation (IaC) + ECS Fargate** 自动化交付体系，系统获得了抵御外部 API 波动与支撑海量并发的生产级高可用底座。

但系统上线后，我们如何客观、量化地评估每一个单据类型的提取质量？如何验证标准答案是否正确生成？证据片段是否命中？页码追溯是否精准？

在专栏的收官之作 **《多维评测体系与质量基线：从标准集构建到 CI/CD 自动化 Benchmark》** 中，我们将揭秘工业级 IDP 系统的全方位自动化评测框架与全景技术路线复盘！
