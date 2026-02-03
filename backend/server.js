import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { createServer } from "node:http";
import cookieParser from "cookie-parser";
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
    origin: "video-confrence-app-ruddy.vercel.app", // frontend URL
    credentials: true,
  }),
);
app.use(express.json({ limit: "50kb" }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/user", userRouter);
app.use("/api/v1/meeting", meetingRoute);

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
  }
};

startServer();
