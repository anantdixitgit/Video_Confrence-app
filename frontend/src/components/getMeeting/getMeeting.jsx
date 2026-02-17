import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./getMeeting.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faClock, faUsers } from "@fortawesome/free-solid-svg-icons";

function GetMeeting() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        "https://video-confrence-app.onrender.com/api/v1/meeting/allmeetings",
        { withCredentials: true },
      );

      if (res.data.success) {
        setMeetings(res.data.meetings || []);
        setError("");
      }
    } catch (err) {
      console.error("Error fetching meetings:", err);
      setError(err.response?.data?.message || "Failed to fetch meetings");
      toast.error("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = (meetingCode) => {
    navigate(`/meet/${meetingCode}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRefresh = () => {
    fetchMeetings();
  };

  return (
    <div className="get-meeting-container">
      <div className="meeting-header">
        <h1>
          <FontAwesomeIcon icon={faVideo} /> My Meetings
        </h1>
        <button className="refresh-btn" onClick={handleRefresh}>
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div className="loading">
          <p>Loading your meetings...</p>
        </div>
      )}

      {error && !loading && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={handleRefresh}>Try Again</button>
        </div>
      )}

      {!loading && meetings.length === 0 && !error && (
        <div className="no-meetings">
          <p>No meetings yet. Create one to get started!</p>
          <button className="create-btn" onClick={() => navigate("/meeting")}>
            Create Meeting
          </button>
        </div>
      )}

      {!loading && meetings.length > 0 && (
        <div className="meetings-grid">
          {meetings.map((meeting) => (
            <div key={meeting._id} className="meeting-card">
              <div className="meeting-header-card">
                <div className="meeting-code-section">
                  <h3>Meeting Code</h3>
                  <p className="meeting-code">{meeting.meetingCode}</p>
                </div>
                <div className={`status-badge ${meeting.status}`}>
                  {meeting.status === "active" ? (
                    <>
                      <span className="status-dot active"></span>
                      Active
                    </>
                  ) : (
                    <>
                      <span className="status-dot inactive"></span>
                      Inactive
                    </>
                  )}
                </div>
              </div>

              <div className="meeting-details">
                <div className="detail-item">
                  <FontAwesomeIcon icon={faClock} />
                  <span>{formatDate(meeting.date)}</span>
                </div>
                <div className="detail-item">
                  <FontAwesomeIcon icon={faUsers} />
                  <span>
                    {meeting.participants}{" "}
                    {meeting.participants === 1
                      ? "participant"
                      : "participants"}
                  </span>
                </div>
              </div>

              <div className="meeting-actions">
                {meeting.status === "active" ? (
                  <button
                    className="join-btn"
                    onClick={() => handleJoinMeeting(meeting.meetingCode)}
                  >
                    Continue Meeting →
                  </button>
                ) : (
                  <button className="inactive-btn" disabled>
                    Meeting Ended
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GetMeeting;
