import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Long-lived vendor chunks, split so no single chunk crosses Vite's 500 kB warning. */
const VENDOR_CHUNKS: Readonly<Record<string, readonly string[]>> = {
  react: ['react', 'react-dom', 'scheduler'],
  motion: ['motion', 'framer-motion', 'motion-dom', 'motion-utils'],
  gsap: ['gsap'],
  icons: ['@phosphor-icons/react'],
};

function vendorChunk(id: string): string | undefined {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id);
  if (!match) return undefined;
  const pkg = match[1];
  for (const [chunk, packages] of Object.entries(VENDOR_CHUNKS)) {
    if (packages.includes(pkg!)) return chunk;
  }
  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks: vendorChunk } },
  },
});
