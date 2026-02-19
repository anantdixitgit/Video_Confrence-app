import { Server } from "socket.io";
import Meeting from "../Models/meetingSchema.js";

let connections = {};
let messages = {};
let timeOnline = {};
let participantInfo = {}; // Structure: { meetingCode: [{socketId, name, isHost, joinedAt}] }
let disconnectedUsers = new Map(); // Structure: Map<socketId, {meetingCode, timeoutId, userData}>

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
    // Performance optimizations
    serveClient: false, // Don't serve socket.io client bundle
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 1e6, // 1MB max message size
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

    socket.on("reconnection-attempt", (data) => {
      const oldSocketId = data.oldSocketId;
      const meetingCode = data.meetingCode;

      // Check if user is in disconnected state
      if (disconnectedUsers.has(oldSocketId)) {
        const disconnectInfo = disconnectedUsers.get(oldSocketId);

        // Clear the timeout
        clearTimeout(disconnectInfo.timeoutId);
        disconnectedUsers.delete(oldSocketId);

        // Update socket ID in connections
        if (connections[meetingCode]) {
          const index = connections[meetingCode].indexOf(oldSocketId);
          if (index > -1) {
            connections[meetingCode][index] = socket.id;
          }
        }

        // Update participant info
        if (participantInfo[meetingCode]) {
          const participant = participantInfo[meetingCode].find(
            (p) => p.socketId === oldSocketId,
          );
          if (participant) {
            participant.socketId = socket.id;
          }
        }

        // Update timeOnline
        if (timeOnline[oldSocketId]) {
          timeOnline[socket.id] = timeOnline[oldSocketId];
          delete timeOnline[oldSocketId];
        }

        // Get list of other users for WebRTC re-negotiation
        const otherUsers = connections[meetingCode]
          ? connections[meetingCode].filter((id) => id !== socket.id)
          : [];

        // Get reconnected user's data
        const userData = disconnectInfo.userData || {};

        // Notify user of successful reconnection with list of users to reconnect to
        socket.emit("reconnection-successful", {
          newSocketId: socket.id,
          meetingCode: meetingCode,
          otherUsers: otherUsers,
          userData: userData,
        });

        // Notify others that user reconnected - they need to re-establish peers
        if (connections[meetingCode]) {
          connections[meetingCode].forEach((peerId) => {
            if (peerId !== socket.id) {
              io.to(peerId).emit("user-reconnected", {
                oldSocketId: oldSocketId,
                newSocketId: socket.id,
                userData: userData,
              });
            }
          });
        }
      }
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

    socket.on("leave-call", (path, ack) => {
      socket.data.leftMeeting = true;

      if (disconnectedUsers.has(socket.id)) {
        const info = disconnectedUsers.get(socket.id);
        clearTimeout(info.timeoutId);
        disconnectedUsers.delete(socket.id);
      }

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

      if (typeof ack === "function") {
        ack();
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
      if (socket.data.leftMeeting) {
        return;
      }

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
        // Get participant info before potential removal
        let participantData = null;
        if (participantInfo[foundRoom]) {
          participantData = participantInfo[foundRoom].find(
            (p) => p.socketId === socketId,
          );
        }

        // Set 30-second grace period for reconnection
        const timeoutId = setTimeout(() => {
          // Remove user after grace period expires
          if (connections[foundRoom]) {
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
                io.to(peerId).emit(
                  "participant-list",
                  participantInfo[foundRoom],
                );
              }
            });

            // Cleanup empty room
            if (connections[foundRoom].length === 0) {
              delete connections[foundRoom];
              delete participantInfo[foundRoom];
            }
          }

          // Remove from disconnected users tracking
          disconnectedUsers.delete(socketId);
        }, 30000); // 30 seconds grace period

        // Store disconnected user info
        disconnectedUsers.set(socketId, {
          meetingCode: foundRoom,
          timeoutId: timeoutId,
          userData: participantData,
        });

        // Notify others that user is temporarily disconnected
        if (connections[foundRoom]) {
          connections[foundRoom].forEach((peerId) => {
            if (peerId !== socketId) {
              io.to(peerId).emit("user-connection-lost", {
                socketId: socketId,
                name: participantData?.name || "Unknown User",
              });
            }
          });
        }
      }
    });
  });

  return io;
};

export const getActiveMeetings = () => {
  return connections;
};
