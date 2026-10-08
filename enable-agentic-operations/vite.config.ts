import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `__dirname` 在 ESM 配置里不存在（package.json 是 "type": "module"），用 URL 换算。
export default defineConfig({
  publicDir: 'output/pdf',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
