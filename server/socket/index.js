import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Group from "../models/Group.js";

const onlineUsers = new Map(); // userId → socketId

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Auth middleware for socket
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) return next(new Error("User not found"));
      socket.user = user;
      next();
    } catch {
      next(new Error("Token invalid"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    onlineUsers.set(userId, socket.id);
    io.emit("online_users", [...onlineUsers.keys()]);

    socket.on("join_group", (groupId) => {
      socket.join(groupId);
    });

    socket.on("leave_group", (groupId) => {
      socket.leave(groupId);
    });

    socket.on("send_message", async ({ groupId, content }) => {
      try {
        const group = await Group.findById(groupId);
        if (!group?.members.includes(socket.user._id)) return;
        const message = await Message.create({
          group: groupId,
          sender: socket.user._id,
          content,
        });
        await message.populate("sender", "name email avatar");
        io.to(groupId).emit("new_message", message);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("typing", ({ groupId }) => {
      socket.to(groupId).emit("user_typing", {
        userId,
        name: socket.user.name,
      });
    });

    socket.on("stop_typing", ({ groupId }) => {
      socket.to(groupId).emit("user_stop_typing", { userId });
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("online_users", [...onlineUsers.keys()]);
    });
  });

  return io;
};
