import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const single = process.env.SINGLE === '1'

export default defineConfig({
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  build: { chunkSizeWarningLimit: 1600 },
})
