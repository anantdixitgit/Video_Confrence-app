import { io } from "socket.io-client";

const SERVER_URL = "https://video-confrence-app.onrender.com";

export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  autoConnect: false,
});

socket.on("connect", () => {});

socket.on("disconnect", () => {});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
});
