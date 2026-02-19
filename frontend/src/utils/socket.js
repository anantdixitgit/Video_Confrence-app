import { io } from "socket.io-client";

const SERVER_URL = "https://video-confrence-app.onrender.com";

export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 3000, // Wait 3s before first retry
  reconnectionDelayMax: 5000, // Max 5s between retries
  reconnectionAttempts: 5, // Try 5 times
  timeout: 10000, // 10s connection timeout
  autoConnect: false, // Prevent auto connection
});

// Store old socket ID for reconnection
let oldSocketId = null;
let currentMeetingCode = null;
let hasEstablishedSession = false; // Track if first connect or reconnect

socket.on("connect", () => {
  // Only attempt reconnection if we previously had an established session
  if (oldSocketId && currentMeetingCode && hasEstablishedSession) {
    socket.emit("reconnection-attempt", {
      oldSocketId: oldSocketId,
      meetingCode: currentMeetingCode,
    });
  }
  oldSocketId = null; // Clear after use
});

// Mark session established after first join
export const markSessionEstablished = () => {
  hasEstablishedSession = true;
};

socket.on("disconnect", () => {
  // Store old socket ID before disconnection
  oldSocketId = socket.id;
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
});

// Helper function to set meeting code (call this when joining a meeting)
export const setMeetingCode = (code) => {
  currentMeetingCode = code;
};

// Helper function to clear meeting code (call this when leaving)
export const clearMeetingCode = () => {
  currentMeetingCode = null;
  oldSocketId = null;
};
