import express from "express";
import verifyToken from "../middleware/Auth.middleware.js";
import Meeting from "../models/meetingSchema.js";
import { createMeeting, joinMeeting } from "../controller/meetingController.js";

const router = express.Router();

router.route("/create").post(verifyToken, createMeeting);
router.route("/join").post(verifyToken, joinMeeting);

export default router;
