import "dotenv/config";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { connectDB } from "./config/db.js";
import "./config/passport.js";
import passport from "passport";
import { initSocket } from "./socket/index.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import groupRoutes from "./routes/groups.js";
import messageRoutes from "./routes/messages.js";
import invitationRoutes from "./routes/invitations.js";
import notificationRoutes from "./routes/notifications.js";

const app = express();
const httpServer = http.createServer(app);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(passport.initialize());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

initSocket(httpServer);

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
