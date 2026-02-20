import express from "express";
import verifyJWT from "../Middleware/Auth.middleware.js";
import Meeting from "../Models/meetingSchema.js";
import {
  createMeeting,
  joinMeeting,
  getallMeetings,
} from "../controller/meetingController.js";
import { cacheMiddleware } from "../Middleware/cacheMiddleware.js";

const router = express.Router();

router.route("/create").post(verifyJWT, createMeeting);
router.route("/join").post(verifyJWT, joinMeeting);
router
  .route("/allmeetings")
  .get(verifyJWT, cacheMiddleware(10), getallMeetings);

export default router;
