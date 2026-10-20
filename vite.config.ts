import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local-only project. `host` stays on loopback so the dev server is not
// reachable from the local network without an explicit opt-in.
//
// `base` is relative for builds only, so the output can be served from any
// subpath (a preview host, a file:// open) rather than assuming the domain
// root. Vite's dev server does not fully support a relative base, so dev
// keeps '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
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
}));
