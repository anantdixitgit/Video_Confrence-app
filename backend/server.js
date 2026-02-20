import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { createServer } from "node:http";
import cookieParser from "cookie-parser";
import compression from "compression";
import connectDB from "./utils/dbconnect.js";
import userRouter from "./routes/userRoute.js";
import meetingRoute from "./routes/meetingRoute.js";
import { connectToSocket } from "./controller/socketManager.js";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://video-confrence-app-ruddy.vercel.app",
      "https://video-confrence-app-sgrb.vercel.app",
    ],
    credentials: true,
  }),
);

// Enable gzip compression for all responses (level 6 for balance of speed vs compression)
app.use(compression({ level: 6, threshold: 1024 }));

app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/user", userRouter);
app.use("/api/v1/meeting", meetingRoute);

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT);
  } catch (error) {
    console.error("Error starting server:", error);
  }
};

startServer();
