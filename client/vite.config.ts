import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  optimizeDeps: {
    // Exclude Monaco and Monaco SQL Languages from dependency optimization
    exclude: ["monaco-editor", "monaco-sql-languages"]
  },
  server: {
    port: 3000,
    strictPort: true, // Don't try other ports if 3000 is taken
    host: true, // Listen on all addresses, including network and LAN
    proxy: {
      "/api": {
        target: "http://server:8000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Fix redirect loops by rewriting Location headers
            if (
              proxyRes.headers.location &&
              proxyRes.headers.location.includes("http://server:8000")
            ) {
              proxyRes.headers.location = proxyRes.headers.location.replace(
                "http://server:8000",
                "http://localhost:3000/api"
              );
            }
          });
        },
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
