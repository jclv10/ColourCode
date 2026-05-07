import { defineConfig } from "vite";

import { assetpackPlugin } from "./scripts/assetpack-vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [assetpackPlugin()],
  server: {
    host: '0.0.0.0',		  
    port: 5175,
    // Allow fallback to the next available port to avoid startup failures
    strictPort: false,
    open: true,
    allowedHosts: [
     // 'colourcode.ltim.uib.es', // Agrega tu dominio aqu�
      'localhost',
	    '192.168.1.15',      // Puedes permitir localhost tambi�n si es necesario
    ]
    ,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    }
    ,
    headers: {
      // Relaxed CSP for dev: allow API & HMR connections across dynamic ports
      'Content-Security-Policy': [
        "default-src 'self'",
        // Permit connecting to any http:/ws: (dev) plus data/blob for loaders/HMR
        "connect-src 'self' http: https: ws: wss: data: blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "media-src 'self' data: blob:",
        "frame-src 'self'",
        // Explicitly allow web workers from blob URLs
        "worker-src 'self' blob:",
        // Some browsers fall back to child-src for workers
        "child-src 'self' blob:"
      ].join('; '),
    }
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
});
