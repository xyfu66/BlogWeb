<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="app-footer">
    <div class="bl-container footer-inner">
      <div class="footer-info">
        <div class="brand">BlogWeb</div>
        <p class="copyright">
          &copy; {{ currentYear }} BitVortex. 保留所有权利。
        </p>
      </div>

      <div class="footer-links">
        <a href="/" target="_blank" rel="noopener noreferrer" class="footer-link">
          官网
        </a>
        <span class="link-divider">/</span>
        <a href="/mss/" target="_blank" rel="noopener noreferrer" class="footer-link">
          节拍律动
        </a>
        <span class="link-divider">/</span>
        <router-link to="/about" class="footer-link">
          关于我
        </router-link>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  margin-top: auto;
  border-top: 1px solid var(--bl-border);
  background: var(--bl-bg-secondary);
  padding: 2.5rem 0;
  color: var(--bl-text-secondary);
  font-size: 0.875rem;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.brand {
  font-weight: 700;
  color: var(--bl-text-highlight);
  margin-bottom: 0.25rem;
}

.copyright {
  font-size: 0.8125rem;
  color: var(--bl-text-muted);
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.footer-link {
  color: var(--bl-text-secondary);
  transition: color var(--bl-dur-fast) var(--bl-ease);
}

.footer-link:hover {
  color: var(--bl-accent);
}

.link-divider {
  color: var(--bl-border);
}

@media (max-width: 640px) {
  .footer-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
