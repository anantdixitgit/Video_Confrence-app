import { Server } from "socket.io";

let connections = {};
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
    console.log("SOMETHING CONNECTED", socket.id);

    socket.on("join-call", (path) => {
      if (!connections[path]) connections[path] = [];

      if (!connections[path].includes(socket.id)) {
        connections[path].push(socket.id);
      }

      timeOnline[socket.id] = new Date();

      connections[path].forEach((id) => {
        io.to(id).emit("user-joined", socket.id, connections[path]);
      });
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("leave-call", (path) => {
      if (!connections[path]) return;

      connections[path] = connections[path].filter((id) => id !== socket.id);

      connections[path].forEach((id) => {
        io.to(id).emit("user-left", socket.id);
      });

      if (connections[path].length === 0) {
        delete connections[path];
      }
    });

    socket.on("disconnect", () => {
      for (const room in connections) {
        if (connections[room].includes(socket.id)) {
          connections[room] = connections[room].filter(
            (id) => id !== socket.id,
          );

          connections[room].forEach((id) => {
            io.to(id).emit("user-left", socket.id);
          });

          if (connections[room].length === 0) {
            delete connections[room];
          }
        }
      }
    });
  });

  return io;
};
