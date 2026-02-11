import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

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

    socket.on("join-call", (data) => {
      const path = typeof data === "string" ? data : data.meetingCode;
      const userData = typeof data === "object" ? data : {};

      if (connections[path] === undefined) {
        connections[path] = [];
      }
      connections[path].push(socket.id);
      timeOnline[socket.id] = new Date();

      // Notify others in the room
      connections[path].forEach((peerId) => {
        if (peerId !== socket.id) {
          io.to(peerId).emit("user-joined", socket.id, connections[path], userData);
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
        ["", false]
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
        connections[path].forEach((elem) => {
          io.to(elem).emit("user-left", socket.id);
        });
        if (connections[path].length === 0) {
          delete connections[path];
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
        ["", false]
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

        // Notify others
        connections[foundRoom].forEach((peerId) => {
          io.to(peerId).emit("user-left", socketId);
        });

        // Cleanup empty room
        if (connections[foundRoom].length === 0) {
          delete connections[foundRoom];
        }
      }
    });
  });

  return io;
};
