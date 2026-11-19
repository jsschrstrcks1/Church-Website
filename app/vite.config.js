import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app (login, admin dashboard, share pages, newsletters) is built into public/app/,
// next to the plain-HTML public site. firebase.json sends the app's URLs to public/app/index.html.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Built files live under /app/; in development everything is served from the root
  base: command === 'build' ? '/app/' : '/',
  // In development, serve the public site's files (logo, photos) at the same paths as on the live site.
  // Not used for the build, which would otherwise copy the whole public site into public/app/.
  publicDir: command === 'build' ? false : '../public',
  build: {
    outDir: '../public/app',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase';
          if (id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react';
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173
  }
}));
