import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // react/react-dom are grouped with vendor-anim rather than split into
        // their own chunk: @react-three/fiber, drei, and postprocessing all
        // import react synchronously, so a standalone 'vendor-react' chunk
        // formed a chunk cycle that Rollup resolved by emptying it and
        // folding react into vendor-anim anyway (confirmed via build output:
        // "Generated an empty chunk: vendor-react"). Colocating them avoids
        // that dead 0kB request; they always load together in practice.
        manualChunks: {
          three: ['three'],
          'vendor-anim': ['react', 'react-dom', 'gsap', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
        },
      },
    },
  },
});
