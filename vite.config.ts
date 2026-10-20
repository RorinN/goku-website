import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local-only project. `host` stays on loopback so the dev server is not
// reachable from the local network without an explicit opt-in.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, open: false },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
