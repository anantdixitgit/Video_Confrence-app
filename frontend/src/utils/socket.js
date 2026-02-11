import { io } from "socket.io-client";

// For local development
// const SERVER_URL = "http://localhost:5000";

// For production (Render Backend URL)
const SERVER_URL = "https://video-confrence-app.onrender.com";

export const socket = io(SERVER_URL, {
  transports: ["websocket"],
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("❌ Socket disconnected");
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
});
