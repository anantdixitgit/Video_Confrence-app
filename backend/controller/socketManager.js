import { Server } from "socket.io";
import Meeting from "../Models/meetingSchema.js";

let connections = {};
let messages = {};
let timeOnline = {};
let participantInfo = {};

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

      let isHost = false;
      try {
        const meeting = await Meeting.findOne({ meetingCode: path });
        if (meeting && userData.userId) {
          isHost = meeting.user_id.toString() === userData.userId;
        }
      } catch (error) {
        console.error("Error querying meeting:", error);
      }

      if (!participantInfo[path]) {
        participantInfo[path] = [];
      }

      const participantExists = participantInfo[path].some(
        (p) => p.socketId === socket.id,
      );

      if (!participantExists) {
        participantInfo[path].push({
          socketId: socket.id,
          name: userData.userName || "Anonymous",
          isHost: isHost,
          joinedAt: new Date(),
        });
      }

      socket.emit("participant-list", participantInfo[path]);

      socket.emit("user-joined", existingUsers, socket.id, userData);

      connections[path].forEach((peerId) => {
        if (peerId !== socket.id) {
          io.to(peerId).emit("user-joined", [socket.id], socket.id, userData);
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

        if (participantInfo[path]) {
          participantInfo[path] = participantInfo[path].filter(
            (p) => p.socketId !== socket.id,
          );
        }

        connections[path].forEach((elem) => {
          io.to(elem).emit("user-left", socket.id);
          if (participantInfo[path]) {
            io.to(elem).emit("participant-list", participantInfo[path]);
          }
        });

        if (connections[path].length === 0) {
          delete connections[path];
          delete participantInfo[path];
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

      let foundRoom = null;
      for (const [room, users] of Object.entries(connections)) {
        if (users.includes(socketId)) {
          foundRoom = room;
          break;
        }
      }

      if (foundRoom) {
        const index = connections[foundRoom].indexOf(socketId);
        if (index > -1) {
          connections[foundRoom].splice(index, 1);
        }

        if (participantInfo[foundRoom]) {
          participantInfo[foundRoom] = participantInfo[foundRoom].filter(
            (p) => p.socketId !== socketId,
          );
        }

        connections[foundRoom].forEach((peerId) => {
          io.to(peerId).emit("user-left", socketId);
          if (participantInfo[foundRoom]) {
            io.to(peerId).emit("participant-list", participantInfo[foundRoom]);
          }
        });

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
