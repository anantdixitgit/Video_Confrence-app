import Meeting from "../Models/meetingSchema.js";
import { getActiveMeetings } from "./socketManager.js";

export const createMeeting = async (req, res) => {
  try {
    const meetingCode = Math.random().toString(36).substring(2, 10);

    const meeting = await Meeting.create({
      user_id: req.user._id,
      meetingCode,
    });

    res.status(201).json({
      success: true,
      meetingCode: meeting.meetingCode,
    });
  } catch (err) {
    res.status(500).json({ message: "Meeting creation failed" });
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

    const meeting = await Meeting.findOne({ meetingCode });

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
    const userId = req.user._id;
    const meetings = await Meeting.find({ user_id: userId }).sort({
      date: -1,
    });

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
    });
  } catch (err) {
    console.log("Error while fetching meetings", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch meetings",
    });
  }
};
