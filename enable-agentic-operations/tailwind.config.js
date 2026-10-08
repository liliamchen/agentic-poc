import cloudaiTheme from '@cloudai-design/tailwind/v3/aidbs'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * 语义 token（`bg-primary`、`text-foreground`、`bg-brand-2` …）、圆角刻度与动效全部由
 * cloudaiTheme 插件注入。**不要**往 CSS 入口手写一份 `:root` 变量，也不要在这里补
 * `colors` / `borderRadius`——那会出现两个真源，而漂开时不报错，只是颜色对不上。
 *
 * 换主题只改上面那行 import 的 subpath。
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // 前八档与 Tailwind v3 默认值等值（差别只是 rem 写成 px）；`code` 与三档 `icon`
      // 是本工程自己的补充档位。CloudAI UI 仓不为它们建真源，因此**组件与页面模板不会
      // 使用** `text-code` / `text-icon*`，它们只供本工程手写页面时用。
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '28px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '36px'],
        '4xl': ['36px', '40px'],
        code: ['13px', '17px'],
        'icon-sm': '16px',
        icon: '20px',
        'icon-lg': '24px',
      },
    },
  },
  plugins: [tailwindcssAnimate, cloudaiTheme],
}
