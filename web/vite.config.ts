import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Backend API URL - reads from env or defaults to localhost:80
  const apiPort = env.VITE_API_PORT || '80';
  const apiHost = env.VITE_API_HOST || 'localhost';
  const apiTarget = `http://${apiHost}:${apiPort}`;
  const wsTarget = `ws://${apiHost}:${apiPort}`;

  console.log(`🔌 Proxying API to: ${apiTarget}`);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: wsTarget,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
