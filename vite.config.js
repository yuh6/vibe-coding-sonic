import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function cloudflareRocketLoaderBypass() {
  return {
    name: 'cloudflare-rocket-loader-bypass',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<script type="module" crossorigin src="\/assets\//g,
        '<script data-cfasync="false" type="module" crossorigin src="/assets/'
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudflareRocketLoaderBypass()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/audio-cache': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
