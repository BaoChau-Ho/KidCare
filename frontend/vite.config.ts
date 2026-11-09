/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  // Test giao diện cần DOM (sessionStorage, render). Đặt ở đây để không phụ thuộc comment đầu từng file.
  test: {
    environment: 'jsdom',
  },
})