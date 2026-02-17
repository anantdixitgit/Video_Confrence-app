import mongoose from "mongoose";
import User from "./userSchema.js";

const meetingSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  meetingCode: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

// Create indexes for faster queries
// Note: meetingCode index is auto-created by unique: true above
meetingSchema.index({ user_id: 1, date: -1 });
meetingSchema.index({ date: -1 });

const Meeting =
  mongoose.models.Meeting || mongoose.model("Meeting", meetingSchema);

export default Meeting;
