import { io } from "socket.io-client";

let socket;

// Phải có từ khóa "export" ở trước hàm
export const connectSocket = () => {
  if (!socket) {
    const token = localStorage.getItem("token"); // Hoặc cách bạn lấy token
    socket = io("/", { // Để "/" vì đã có proxy trong vite.config
      auth: { token },
      transports: ["websocket"],
    });
  }
  return socket;
};

// Hoặc nếu bạn muốn dùng export default thì bỏ dấu { } ở file VideoCall