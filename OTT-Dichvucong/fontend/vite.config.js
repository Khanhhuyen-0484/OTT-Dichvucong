import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["localhost", ".ngrok-free.app", "transform-slobbery-fondue.ngrok-free.dev"],
    proxy: {
<<<<<<< HEAD
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});

=======
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:3000", ws: true, changeOrigin: true },
    },
    // Nếu bạn đang chạy qua Ngrok, hãy đảm bảo set biến môi trường NGROK_HOST
    hmr: process.env.NGROK_HOST ? {
      protocol: "wss",
      clientPort: 443,
    } : true,
  },
});
>>>>>>> 49573e7 (update videocall)
