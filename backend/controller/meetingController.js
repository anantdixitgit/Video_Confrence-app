import Meeting from "../Models/meetingSchema.js";
import { randomBytes } from "node:crypto";
import { getActiveMeetings } from "./socketManager.js";

export const createMeeting = async (req, res) => {
  try {
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const meetingCode = randomBytes(4).toString("hex");

      try {
        const newMeeting = await Meeting.create({
          user_id: req._id || req.user?._id,
          meetingCode,
        });

        return res.status(201).json({
          success: true,
          meetingCode: newMeeting.meetingCode,
        });
      } catch (error) {
        const isDuplicateMeetingCode =
          error?.code === 11000 &&
          (error?.keyPattern?.meetingCode ||
            String(error?.message || "").includes("meetingCode"));

        if (!isDuplicateMeetingCode) {
          throw error;
        }
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to generate unique meeting code",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Meeting creation failed",
    });
  }
};

export const joinMeeting = async (req, res) => {
  try {
    const { meetingCode } = req.body;

    if (!meetingCode) {
      return res.status(400).json({
        success: false,
        message: "Meeting code is required",
      });
    }

    // Use lean() for read-only queries - faster response
    const meeting = await Meeting.findOne({ meetingCode }).lean();

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    res.json({
      success: true,
      meetingCode,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to join meeting",
    });
  }
};

export const getallMeetings = async (req, res) => {
  try {
    const userId = req._id || req.user?._id;

    // Fetch 31 to check if there are more meetings beyond 30
    const allMeetings = await Meeting.find({ user_id: userId })
      .select("meetingCode date")
      .sort({ date: -1 })
      .limit(31)
      .lean();

    // Only return 30, but let frontend know if there are more
    const meetings = allMeetings.slice(0, 30);
    const hasMore = allMeetings.length > 30;

    // Get active meetings from socket connections
    const activeMeetings = getActiveMeetings();

    // Add status to each meeting
    const meetingsWithStatus = meetings.map((meeting) => ({
      _id: meeting._id,
      meetingCode: meeting.meetingCode,
      date: meeting.date,
      status:
        activeMeetings[meeting.meetingCode] &&
        activeMeetings[meeting.meetingCode].length > 0
          ? "active"
          : "inactive",
      participants: activeMeetings[meeting.meetingCode]?.length || 0,
    }));

    res.status(200).json({
      success: true,
      message: "Meetings fetched successfully",
      meetings: meetingsWithStatus,
      hasMore,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch meetings",
    });
  }
};
