import { defineConfig } from 'vite';
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import manifest from './manifest.json' assert { type: 'json' };

export default defineConfig({
  plugins: [crx({ manifest: manifest as ManifestV3Export })],
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
