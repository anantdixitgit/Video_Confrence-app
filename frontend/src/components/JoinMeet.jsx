import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./JoinMeet.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

function JoinMeeting() {
  const [meetingCode, setMeetingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const SERVER_URL = "https://video-confrence-app.onrender.com";

  // Create meeting
  const handleCreateMeeting = async () => {
    if (loading) return;

    try {
      setLoading(true);
      const res = await axios.post(
        `${SERVER_URL}/api/v1/meeting/create`,
        {},
        { withCredentials: true },
      );

      if (res.data.success) {
        navigate(`/meet/${res.data.meetingCode}`);
      }
    } catch (error) {
      console.error("Create meeting error:", error);
      toast.error("Failed to create meeting");
    } finally {
      setLoading(false);
    }
  };

  // Join meeting
  const handleJoinMeeting = async () => {
    if (!meetingCode) {
      toast.warning("Enter meeting ID");
      return;
    }

    if (loading) return;

    try {
      setLoading(true);
      const res = await axios.post(
        `${SERVER_URL}/api/v1/meeting/join`,
        { meetingCode },
        { withCredentials: true },
      );

      if (res.data.success) {
        navigate(`/meet/${meetingCode}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to join meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-meeting-page">
      <div className="join-meeting-card">
        <h2>Start or Join a Meeting</h2>
        <div className="join-section">
          <button
            className="primary-btn"
            onClick={handleCreateMeeting}
            disabled={loading}
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> Creating...
              </>
            ) : (
              "Create New Meeting"
            )}
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

          <button
            className="secondary-btn"
            onClick={handleJoinMeeting}
            disabled={loading}
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> Joining...
              </>
            ) : (
              "Join Meeting"
            )}
          </button>
        </div>
        <div className="divider">OR</div>
        <div className="join-section">
          <button
            className="my-meetings-btn"
            onClick={() => navigate("/my-meetings")}
          >
            My Meetings
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinMeeting;
