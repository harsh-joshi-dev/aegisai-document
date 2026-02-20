import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5073,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          // Log Set-Cookie headers from backend to verify they're forwarded
          proxy.on('proxyRes', (proxyRes, req) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log(`[Proxy] Set-Cookie for ${req.url}:`, setCookie);
            }
          });
        },
      },
    },
  },
});
