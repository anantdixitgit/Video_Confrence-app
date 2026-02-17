import Meeting from "../Models/meetingSchema.js";
import { getActiveMeetings } from "./socketManager.js";

export const createMeeting = async (req, res) => {
  try {
    let meetingCode;
    let meeting;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      meetingCode = Math.random().toString(36).substring(2, 10);
      meeting = await Meeting.findOne({ meetingCode }).lean();
      if (!meeting) break;
      attempts++;
    }

    if (meeting) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate unique meeting code",
      });
    }

    const newMeeting = await Meeting.create({
      user_id: req.user._id,
      meetingCode,
    });

    res.status(201).json({
      success: true,
      meetingCode: newMeeting.meetingCode,
    });
  } catch (err) {
    res.status(500).json({
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
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const meetings = await Meeting.find({ user_id: userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Meeting.countDocuments({ user_id: userId });

    const activeMeetings = getActiveMeetings();

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
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch meetings",
    });
  }
};
