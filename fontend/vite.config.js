import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => {
  const isNgrok = process.env.VITE_NGROK === "true";

  return {
    plugins: [react(), tailwindcss()],
    esbuild: {
      drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("react") || id.includes("react-router-dom")) return "react-vendor";
            if (id.includes("socket.io-client")) return "socket-vendor";
            if (id.includes("lucide-react")) return "icons-vendor";
            return "vendor";
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,

      // BUG FIX: Xóa COEP "require-corp" vì nó chặn WebSocket của socket.io
      // và chặn các resource cross-origin khác.
      // Chỉ cần COOP để browser cấp quyền camera/mic trên ngrok HTTPS là đủ.
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        // "Cross-Origin-Embedder-Policy": "require-corp", // ❌ Đã xóa - gây lỗi socket
      },

      allowedHosts: [
        "localhost",
        ".ngrok-free.app",
        ".ngrok-free.dev",
        "transform-slobbery-fondue.ngrok-free.dev",
      ],

      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: "http://localhost:3000",
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },

      hmr: {
        protocol: isNgrok ? "wss" : "ws",
        clientPort: isNgrok ? 443 : 5173,
      },
    },
  };
});
