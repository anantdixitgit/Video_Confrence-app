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
    socket.on("join-call", async (data) => {
      const path = typeof data === "string" ? data : data.meetingCode;
      const userData = typeof data === "object" ? data : {};

      if (connections[path] === undefined) {
        connections[path] = [];
      }

      const existingUsers = [...connections[path]];
      connections[path].push(socket.id);
      timeOnline[socket.id] = new Date();

      // Determine if user is the host
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

      // Initialize participant info for this meeting
      if (!participantInfo[path]) {
        participantInfo[path] = [];
      }

      // Check if participant already exists to avoid duplicates
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
      } else {
      }

      // Send participant list to joining user
      socket.emit("participant-list", participantInfo[path]);

      // Send new user the list of existing users to create peers with
      socket.emit("user-joined", existingUsers, socket.id, userData);

      // Broadcast updated participant list to others
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

        // Remove user from participant info
        if (participantInfo[path]) {
          participantInfo[path] = participantInfo[path].filter(
            (p) => p.socketId !== socket.id,
          );
        }

        // Notify others and send updated participant list
        connections[path].forEach((elem) => {
          io.to(elem).emit("user-left", socket.id);
          // Send updated participant list to remaining users
          if (participantInfo[path]) {
            io.to(elem).emit("participant-list", participantInfo[path]);
          }
        });

        // Cleanup empty room
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

        // Remove user from participant info
        if (participantInfo[foundRoom]) {
          participantInfo[foundRoom] = participantInfo[foundRoom].filter(
            (p) => p.socketId !== socketId,
          );
        }

        // Notify others and send updated participant list
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
          delete participantInfo[foundRoom];
        }
      }
    });
  });

  return io;
};

export const getActiveMeetings = () => {
  return connections;
};
