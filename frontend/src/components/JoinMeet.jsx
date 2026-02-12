import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./JoinMeet.css";

function JoinMeeting() {
  const [meetingCode, setMeetingCode] = useState("");
  const navigate = useNavigate();

  // For local development
  const SERVER_URL = "http://localhost:5000";
  // For production
  // const SERVER_URL = "https://video-confrence-app.onrender.com";

  // Create meeting
  const handleCreateMeeting = async () => {
    try {
      console.log("before createmeeting call");
      const res = await axios.post(
        `${SERVER_URL}/api/v1/meeting/create`,
        {},
        { withCredentials: true },
      );
      console.log(res.data);

      if (res.data.success) {
        navigate(`/meet/${res.data.meetingCode}`);
      }
    } catch (error) {
      console.error("Create meeting error:", error);
      toast.error("Failed to create meeting");
    }
  };

  // Join meeting
  const handleJoinMeeting = async () => {
    if (!meetingCode) {
      toast.warning("Enter meeting ID");
      return;
    }

    try {
      const res = await axios.post(
        `${SERVER_URL}/api/v1/meeting/join`,
        { meetingCode },
        { withCredentials: true },
      );

      if (res.data.success) {
        navigate(`/meet/${meetingCode}`);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to join meeting");
    }
  };

  return (
    <div className="join-meeting-page">
      <div className="join-meeting-card">
        <h2>Start or Join a Meeting</h2>

        <div className="join-section">
          <button className="primary-btn" onClick={handleCreateMeeting}>
            Create New Meeting
          </button>
        </div>

        <div className="divider">OR</div>

        <div className="join-section">
          <input
            type="text"
            placeholder="Enter Meeting ID"
            value={meetingCode}
            onChange={(e) => setMeetingCode(e.target.value)}
            className="meeting-input"
          />

          <button className="secondary-btn" onClick={handleJoinMeeting}>
            Join Meeting
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinMeeting;
