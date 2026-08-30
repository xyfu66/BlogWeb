<script setup lang="ts">
const techSkills = [
  {
    category: '开发语言',
    items: [
      'C# / .NET',
      'Java (Spring / Java EE)',
      'SQL (数据建模与性能调优)',
      'JavaScript / TypeScript / HTML5 / CSS3',
      'Python / C / C++ / Shell / VB.NET',
    ],
  },
  {
    category: '数据库与存储',
    items: [
      'PostgreSQL / SQL Server',
      'Oracle / MySQL / SQLite',
      'AWS / Hadoop / 阿里云',
    ],
  },
  {
    category: '前端与跨端开发',
    items: [
      'Vue.js (Vue 2 / Vue 3) / Element Plus',
      'Android 原生移动端开发',
      '现代 Web 交互与响应式界面设计',
    ],
  },
  {
    category: '系统与业务领域',
    items: [
      'Windows / Linux 操作系统与环境配置',
      '金融、保险、物流等行业核心业务系统经验',
      'Nginx / 自动化脚本与基础部署',
    ],
  },
]
</script>

<template>
  <div class="about-view">
    <!-- Header Banner -->
    <section class="about-header-banner">
      <div class="bl-container">
        <div class="header-inner">
          <div class="profile-avatar">
            <div class="avatar-glow"></div>
            <div class="avatar-text">BV (BitVortex Tech)</div>
          </div>
          <div class="profile-heading">
            <h1 class="profile-name">刘祎锦</h1>
            <p class="profile-tagline">全栈架构师 & 算法工程师</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Content Area -->
    <div class="bl-container about-content-wrap">
      <!-- Bio Section -->
      <section class="about-section bl-card">
        <h2 class="section-heading">
          <span class="heading-num">01.</span> 关于我
        </h2>
        <div class="bio-text">
          <p>
            欢迎来到我的个人技术博客。我是一名深耕于现代 Web 全栈技术、分布式架构与音频算法工程的工程师。
          </p>
          <p>
            目前主要负责 <strong>BitVortex</strong> 核心系统的架构设计与工程落地。
          </p>
          <p>
            在这里，我将持续分享关于AI智能体落地、前端性能极致优化、大规模系统高可用设计、现代微服务交付流水线以及音频信号处理等领域的实践总结与架构思考。
          </p>
        </div>
      </section>

      <!-- Skills Matrix -->
      <section class="about-section bl-card">
        <h2 class="section-heading">
          <span class="heading-num">02.</span> 技术专长与技术栈
        </h2>
        <div class="skills-grid">
          <div v-for="skill in techSkills" :key="skill.category" class="skill-category-card">
            <h3 class="category-title">{{ skill.category }}</h3>
            <ul class="skill-list">
              <li v-for="item in skill.items" :key="item" class="skill-item">
                <span class="skill-bullet">▹</span>
                {{ item }}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Projects and Products Reference -->
      <section class="about-section bl-card">
        <h2 class="section-heading">
          <span class="heading-num">03.</span> 正在构建与维护的产品
        </h2>
        <div class="projects-list">
          <div class="project-item">
            <div class="project-header">
              <h3 class="project-name">节拍律动</h3>
              <span class="project-badge">核心产品</span>
            </div>
            <p class="project-desc">
              专业弦乐智能伴奏与音轨制作工作站，包含 Web 端控制台 (Portal & Studio)、后端 FastAPI 高并发引擎、以及 Android 移动端原生应用。
            </p>
            <div class="project-links">
              <a href="/mss/" target="_blank" rel="noopener noreferrer" class="project-link">
                访问产品控制台 &rarr;
              </a>
            </div>
          </div>

          <div class="project-item">
            <div class="project-header">
              <h3 class="project-name">BitVortex 官方平台</h3>
              <span class="project-badge">企业站</span>
            </div>
            <p class="project-desc">
              BitVortex 品牌官网，基于尖端 WebGL 视觉与声学设计语言打造的前沿数字展示门户。
            </p>
            <div class="project-links">
              <a href="/" target="_blank" rel="noopener noreferrer" class="project-link">
                访问官网 &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.about-view {
  padding-bottom: 5rem;
}

.about-header-banner {
  padding: 4rem 0 3rem;
  background: radial-gradient(circle at 50% -20%, rgba(88, 166, 255, 0.15), transparent 70%);
  border-bottom: 1px solid var(--bl-border);
  margin-bottom: 2.5rem;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.profile-avatar {
  position: relative;
  width: 88px;
  height: 88px;
  flex-shrink: 0;
}

.avatar-glow {
  position: absolute;
  inset: -4px;
  background: linear-gradient(135deg, #58a6ff, #bc8cff);
  border-radius: 50%;
  filter: blur(8px);
  opacity: 0.6;
}

.avatar-text {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #58a6ff, #bc8cff);
  color: #0d1117;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 2rem;
}

.profile-heading {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.profile-name {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
  letter-spacing: -0.02em;
}

.profile-tagline {
  font-size: 1.125rem;
  color: var(--bl-accent);
  font-weight: 500;
}

.about-content-wrap {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 920px;
}

.about-section {
  padding: 2.5rem;
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--bl-border);
}

.heading-num {
  color: var(--bl-accent);
  font-family: var(--bl-font-mono);
  font-size: 1.25rem;
}

.bio-text {
  color: var(--bl-text-secondary);
  font-size: 1.0625rem;
  line-height: 1.8;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bio-text strong {
  color: var(--bl-text-highlight);
}


/* Skills Grid */
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 1.5rem;
}

.skill-category-card {
  background: var(--bl-bg-secondary);
  padding: 1.5rem;
  border-radius: var(--bl-radius-md);
  border: 1px solid var(--bl-border);
}

.category-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 1rem;
}

.skill-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.skill-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  color: var(--bl-text-secondary);
  font-size: 0.9375rem;
}

.skill-bullet {
  color: var(--bl-accent);
  font-size: 0.875rem;
}

/* Projects List */
.projects-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.project-item {
  padding: 1.5rem;
  background: var(--bl-bg-secondary);
  border-radius: var(--bl-radius-md);
  border: 1px solid var(--bl-border);
}

.project-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.project-name {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
}

.project-badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  background: var(--bl-accent-soft);
  color: var(--bl-accent);
  border-radius: var(--bl-radius-full);
  font-weight: 500;
}

.project-desc {
  color: var(--bl-text-secondary);
  font-size: 0.9375rem;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.project-links {
  display: flex;
}

.project-link {
  color: var(--bl-accent);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.project-link:hover {
  color: var(--bl-accent-hover);
  text-decoration: underline;
}

@media (max-width: 768px) {
  .header-inner {
    flex-direction: column;
    text-align: center;
  }

  .skills-grid {
    grid-template-columns: 1fr;
  }


  .about-section {
    padding: 1.5rem;
  }
}
</style>
