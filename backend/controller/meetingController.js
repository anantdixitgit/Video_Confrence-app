import Meeting from "../Models/meetingSchema.js";

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
