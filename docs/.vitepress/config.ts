import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/my_blog/',
  title: "MayRay",
  description: "A VitePress Blog",
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: 'web', link: '/web/' },
    ],
    sidebar: {
      '/web/': [
        {
          text: '文章列表',
          items: [
            { text: '基于 Vite 优化前端镜像', link: '/web/vite-build' },
            { text: 'Git push 时预检分支', link: '/web/git-pre-push' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/MayRay822' }
    ]
  },
  head: [
    ['link', { rel: 'icon', href: '/cursor_auto_build_blog/favicon.ico' }]
  ]
}) 