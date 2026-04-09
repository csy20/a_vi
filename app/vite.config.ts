import { defineConfig }   from 'vite'
import react              from '@vitejs/plugin-react'
import wasm               from 'vite-plugin-wasm'
import topLevelAwait      from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    react(),
    wasm(),           // enables .wasm imports (wasm-pack --target web output)
    topLevelAwait(),  // required: wasm init uses top-level await
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
