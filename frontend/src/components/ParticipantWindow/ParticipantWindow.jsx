import React, { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCrown } from "@fortawesome/free-solid-svg-icons";
import "./ParticipantWindow.css";

function ParticipantWindow({ isOpen, onClose, participantsList }) {
  const panelRef = useRef(null);

  // ========== CLOSE ON CLICK OUTSIDE ==========
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  return (
    <div className={`participant-panel ${isOpen ? "open" : ""}`} ref={panelRef}>
      <div className="panel-header">
        <h3>Participants ({participantsList.length})</h3>
        <button className="close-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

      <div className="participant-items">
        {participantsList.length === 0 ? (
          <div className="empty-state">No participants yet</div>
        ) : (
          participantsList.map((participant) => (
            <div key={participant.socketId} className="participant-item">
              <div className="participant-info">
                <span className="participant-name">{participant.name}</span>
                {participant.isHost && (
                  <span className="host-badge">
                    <FontAwesomeIcon icon={faCrown} /> Host
                  </span>
                )}
              </div>
              <span className="participant-status">Online</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ParticipantWindow;
