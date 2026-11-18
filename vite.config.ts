import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const single = process.env.SINGLE === '1'

// three's DRACOLoader names its own decoder files with `new URL(...)`, which makes Vite copy about 830 KB of them into the
// build even though the site loads its own (public/draco, the smaller glTF-only WebAssembly decoder). Blank those names out.
const ownDracoOnly = {
  name: 'own-draco-only',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('/loaders/DRACOLoader.js')) return null
    return code.replace(/new URL\(\s*'[^']*',\s*import\.meta\.url\s*\)\.toString\(\)/g, "''")
  },
}

export default defineConfig({
  plugins: [ownDracoOnly, react(), ...(single ? [viteSingleFile()] : [])],
  build: { chunkSizeWarningLimit: 1600 },
})
