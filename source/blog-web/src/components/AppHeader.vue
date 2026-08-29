<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import SearchBar from './SearchBar.vue'

const route = useRoute()
const isMobileMenuOpen = ref(false)

const navLinks = [
  { name: '首页', path: '/' },
  { name: '关于我', path: '/about' },
]

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}
</script>

<template>
  <header class="app-header">
    <div class="bl-container header-inner">
      <!-- Logo -->
      <router-link to="/" class="brand-logo">
        <div class="logo-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
        </div>
        <div class="logo-text">
          <span class="logo-name">博客</span>
          <span class="logo-badge">比特漩涡</span>
        </div>
      </router-link>

      <!-- Desktop Nav & Search -->
      <div class="header-actions">
        <SearchBar class="header-search" />

        <nav class="desktop-nav">
          <router-link
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="nav-link"
            :class="{ 'is-active': route.path === link.path }"
          >
            {{ link.name }}
          </router-link>
        </nav>
      </div>

      <!-- Mobile Hamburger Button -->
      <button class="mobile-toggle" @click="toggleMobileMenu" aria-label="Toggle Navigation">
        <svg v-if="!isMobileMenuOpen" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Mobile Drawer Nav -->
    <transition name="mobile-menu">
      <div v-if="isMobileMenuOpen" class="mobile-menu">
        <div class="mobile-search-wrapper">
          <SearchBar />
        </div>
        <nav class="mobile-nav">
          <router-link
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="mobile-nav-link"
            :class="{ 'is-active': route.path === link.path }"
            @click="isMobileMenuOpen = false"
          >
            {{ link.name }}
          </router-link>
        </nav>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: var(--bl-header-height);
  background: var(--bl-surface-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--bl-border);
  z-index: 50;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  gap: 1.5rem;
  flex-wrap: nowrap;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--bl-text-highlight);
  transition: transform var(--bl-dur-fast) var(--bl-ease);
  flex-shrink: 0;
  white-space: nowrap;
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.2), rgba(188, 140, 255, 0.2));
  border: 1px solid rgba(88, 166, 255, 0.3);
  border-radius: var(--bl-radius-md);
  color: var(--bl-accent);
  flex-shrink: 0;
}

.logo-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.logo-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 8px;
  font-size: 0.725rem;
  line-height: normal;
  background: var(--bl-accent-soft);
  color: var(--bl-accent);
  border-radius: var(--bl-radius-full);
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  box-sizing: border-box;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
  flex-wrap: nowrap;
}

.header-search {
  width: 240px;
  max-width: 240px;
  flex-shrink: 0;
}

.desktop-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--bl-text-secondary);
  padding: 0.4rem 0.8rem;
  border-radius: var(--bl-radius-sm);
  transition: all var(--bl-dur-fast) var(--bl-ease);
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.5;
}

.nav-link:hover {
  color: var(--bl-text-highlight);
  background: var(--bl-surface-hover);
}

.nav-link.is-active {
  color: var(--bl-accent);
  background: var(--bl-accent-soft);
  font-weight: 600;
}

.mobile-toggle {
  display: none;
  background: transparent;
  border: none;
  color: var(--bl-text);
  cursor: pointer;
  padding: 0.5rem;
}

@media (max-width: 768px) {
  .header-actions {
    display: none;
  }

  .mobile-toggle {
    display: flex;
    align-items: center;
  }
}

/* Mobile Dropdown */
.mobile-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #161b22;
  border-bottom: 1px solid var(--bl-border);
  padding: 1.25rem;
  box-shadow: var(--bl-shadow-lg);
}

.mobile-search-wrapper {
  margin-bottom: 1rem;
}

.mobile-search-wrapper :deep(.search-bar-container) {
  max-width: 100%;
}

.mobile-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mobile-nav-link {
  padding: 0.75rem 1rem;
  border-radius: var(--bl-radius-md);
  color: var(--bl-text-secondary);
  font-size: 1rem;
  font-weight: 500;
}

.mobile-nav-link.is-active {
  background: var(--bl-accent-soft);
  color: var(--bl-accent);
}

.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: all 0.25s var(--bl-ease);
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
