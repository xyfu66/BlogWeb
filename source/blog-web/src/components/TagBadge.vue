<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    tag: string
    count?: number
    active?: boolean
    clickable?: boolean
  }>(),
  {
    count: undefined,
    active: false,
    clickable: true,
  },
)

const router = useRouter()

function handleClick(e: MouseEvent) {
  if (!props.clickable) return
  e.stopPropagation()
  router.push({ name: 'tag-filter', params: { tag: props.tag } })
}
</script>

<template>
  <span
    class="bl-tag"
    :class="{ 'is-active': active, 'is-clickable': clickable }"
    @click="handleClick"
  >
    <span class="tag-hash">#</span>
    <span class="tag-name">{{ tag }}</span>
    <span v-if="count !== undefined" class="tag-count">{{ count }}</span>
  </span>
</template>

<style scoped>
.tag-hash {
  opacity: 0.6;
  font-weight: 400;
}

.tag-name {
  font-weight: 500;
}

.tag-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  margin-left: 0.2rem;
}

.is-active .tag-count {
  background: rgba(0, 0, 0, 0.2);
  color: #0d1117;
}
</style>
