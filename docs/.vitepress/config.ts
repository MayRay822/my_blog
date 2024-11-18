import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/cursor_auto_build_blog/',
  title: "My Blog",
  description: "A VitePress Blog",
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/articles/' },
      { text: '关于', link: '/about' }
    ],
    sidebar: {
      '/articles/': [
        {
          text: '文章列表',
          items: [
            // 这里可以添加您的文章链接
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/RuiMM' }
    ]
  },
  head: [
    ['link', { rel: 'icon', href: '/cursor_auto_build_blog/favicon.ico' }]
  ]
}) 