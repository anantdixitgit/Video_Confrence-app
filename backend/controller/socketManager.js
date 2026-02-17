import { Server } from "socket.io";
import Meeting from "../Models/meetingSchema.js";

let connections = {};
let messages = {};
let timeOnline = {};
let participantInfo = {}; // Structure: { meetingCode: [{socketId, name, isHost, joinedAt}] }

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("SOMETHING CONNECTED");

    socket.on("join-call", async (data) => {
      const path = typeof data === "string" ? data : data.meetingCode;
      const userData = typeof data === "object" ? data : {};

      // ========== DEBUG LOGGING ==========
      console.log("Join-call received:", {
        meetingCode: path,
        userData: userData,
      });

      if (connections[path] === undefined) {
        connections[path] = [];
      }

      const existingUsers = [...connections[path]];
      connections[path].push(socket.id);
      timeOnline[socket.id] = new Date();

      // ========== NEW: QUERY DATABASE TO DETERMINE HOST ==========
      let isHost = false;
      try {
        const meeting = await Meeting.findOne({ meetingCode: path });
        if (meeting && userData.userId) {
          // Compare meeting creator (user_id) with joining user's ID
          isHost = meeting.user_id.toString() === userData.userId;
        }
      } catch (error) {
        console.error("Error querying meeting:", error);
      }

      // ========== NEW: INITIALIZE PARTICIPANT INFO FOR THIS MEETING ==========
      if (!participantInfo[path]) {
        participantInfo[path] = [];
      }

      // ========== NEW: CHECK IF PARTICIPANT ALREADY EXISTS (DEDUPLICATE) ==========
      const participantExists = participantInfo[path].some(
        (p) => p.socketId === socket.id,
      );

      if (!participantExists) {
        // Only add if not already in the list
        participantInfo[path].push({
          socketId: socket.id,
          name: userData.userName || "Anonymous",
          isHost: isHost,
          joinedAt: new Date(),
        });

        // ========== DEBUG LOGGING ==========
        console.log(`Participant list for ${path}:`, participantInfo[path]);
      } else {
        console.log(
          `Participant ${socket.id} already exists, skipping duplicate`,
        );
      }

      // ========== NEW: SEND PARTICIPANT LIST TO JOINING USER ==========
      socket.emit("participant-list", participantInfo[path]);

      // Send new user the list of existing users to create peers with
      socket.emit("user-joined", existingUsers, socket.id, userData);

      // ========== NEW: BROADCAST UPDATED PARTICIPANT LIST TO OTHERS ==========
      connections[path].forEach((peerId) => {
        if (peerId !== socket.id) {
          io.to(peerId).emit("user-joined", [socket.id], socket.id, userData);
          // Send updated participant list to all existing participants
          io.to(peerId).emit("participant-list", participantInfo[path]);
        }
      });
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("media-status", (data) => {
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomValue]) => {
          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true];
          }
          return [room, isFound];
        },
        ["", false],
      );

      if (found) {
        connections[matchingRoom].forEach((elem) => {
          if (elem !== socket.id) {
            io.to(elem).emit("media-status", data);
          }
        });
      }
    });

    socket.on("leave-call", (path) => {
      if (connections[path]) {
        const index = connections[path].indexOf(socket.id);
        if (index > -1) {
          connections[path].splice(index, 1);
        }

        // ========== NEW: REMOVE USER FROM PARTICIPANT INFO ==========
        if (participantInfo[path]) {
          const initialLength = participantInfo[path].length;
          participantInfo[path] = participantInfo[path].filter(
            (p) => p.socketId !== socket.id,
          );
          // ========== DEBUG LOGGING ==========
          console.log(
            `User ${socket.id} left. Removed ${initialLength - participantInfo[path].length} entries. List now:`,
            participantInfo[path],
          );
        }

        // ========== NEW: NOTIFY OTHERS & SEND UPDATED PARTICIPANT LIST ==========
        connections[path].forEach((elem) => {
          io.to(elem).emit("user-left", socket.id);
          // Send updated participant list to remaining users
          if (participantInfo[path]) {
            io.to(elem).emit("participant-list", participantInfo[path]);
          }
        });

        // ========== NEW: CLEANUP EMPTY ROOM ==========
        if (connections[path].length === 0) {
          delete connections[path];
          delete participantInfo[path]; // Clean up participant info when room is empty
        }
      }
    });

    socket.on("chat-message", (data, sender) => {
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomValue]) => {
          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true];
          }
          return [room, isFound];
        },
        ["", false],
      );

      if (found) {
        if (messages[matchingRoom] === undefined) {
          messages[matchingRoom] = [];
        }
        messages[matchingRoom].push({
          sender: sender,
          data: data,
          "socket-id-sender": socket.id,
        });

        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    socket.on("disconnect", () => {
      const socketId = socket.id;

      // Find the room the user was in
      let foundRoom = null;
      for (const [room, users] of Object.entries(connections)) {
        if (users.includes(socketId)) {
          foundRoom = room;
          break;
        }
      }

      if (foundRoom) {
        // Remove user from room
        const index = connections[foundRoom].indexOf(socketId);
        if (index > -1) {
          connections[foundRoom].splice(index, 1);
        }

        // ========== NEW: REMOVE USER FROM PARTICIPANT INFO ==========
        if (participantInfo[foundRoom]) {
          const initialLength = participantInfo[foundRoom].length;
          participantInfo[foundRoom] = participantInfo[foundRoom].filter(
            (p) => p.socketId !== socketId,
          );
          // ========== DEBUG LOGGING ==========
          console.log(
            `User ${socketId} disconnected. Removed ${initialLength - participantInfo[foundRoom].length} entries. List now:`,
            participantInfo[foundRoom],
          );
        }

        // ========== NEW: NOTIFY OTHERS & SEND UPDATED PARTICIPANT LIST ==========
        connections[foundRoom].forEach((peerId) => {
          io.to(peerId).emit("user-left", socketId);
          // Send updated participant list to remaining users
          if (participantInfo[foundRoom]) {
            io.to(peerId).emit("participant-list", participantInfo[foundRoom]);
          }
        });

        // Cleanup empty room
        if (connections[foundRoom].length === 0) {
          delete connections[foundRoom];
          delete participantInfo[foundRoom]; // ========== NEW ==========
        }
      }
    });
  });

  return io;
};

// ========== EXPORT FUNCTION TO CHECK ACTIVE MEETINGS ==========
export const getActiveMeetings = () => {
  return connections;
};
