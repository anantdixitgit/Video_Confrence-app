import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  socket,
  setMeetingCode,
  clearMeetingCode,
  markSessionEstablished,
} from "../../utils/socket";
import "./VideoMeet.css";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import ParticipantWindow from "../ParticipantWindow/ParticipantWindow";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faVideo,
  faVideoSlash,
  faPhoneSlash,
} from "@fortawesome/free-solid-svg-icons";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function VideoMeet() {
  const { meetingCode } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const localVideoRef = useRef(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const remoteStreamsRef = useRef(new Map()); // socketId -> MediaStream

  const pendingIceRef = useRef(new Map()); // socketId -> candidates
  const pendingLocalIceRef = useRef(new Map()); // socketId -> candidates
  const initializeRef = useRef(false);
  const participantNamesRef = useRef(new Map()); // socketId -> name
  const joinTimeoutRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const isLeavingRef = useRef(false);

  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [participantsList, setParticipantsList] = useState([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connected"); // 'connected', 'reconnecting', 'disconnected'

  /* ---------- BLACK VIDEO TRACK ---------- */
  const createBlackVideoTrack = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas.captureStream().getVideoTracks()[0];
  };

  /* ---------- START MEDIA ---------- */
  const startMedia = async () => {
    // Don't start media if already running
    if (localStreamRef.current && localStreamRef.current.active) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Default: Camera and Mic ON
      setMicOn(true);
      setCameraOn(true);

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing media:", error);
      toast.error(
        "Failed to access camera/microphone. Please check permissions.",
      );
    }
  };

  /* ---------- SOCKET + INIT ---------- */
  useEffect(() => {
    const peersRefCurrent = peersRef.current;
    const namesRefCurrent = participantNamesRef.current;

    /* ---------- ADD LOCAL TRACKS ---------- */
    const addLocalTracks = (peer) => {
      if (!localStreamRef.current) return;

      localStreamRef.current.getTracks().forEach((track) => {
        // Check if track already added
        const senders = peer.getSenders();
        const alreadyAdded = senders.some((player) => player.track === track);

        if (!alreadyAdded) {
          const sender = peer.addTrack(track, localStreamRef.current);
          if (track.kind === "audio") peer._senders.audio = sender;
          if (track.kind === "video") peer._senders.video = sender;
        }
      });
    };

    /* ---------- CREATE PEER ---------- */
    const createPeer = (targetSocketId) => {
      if (peersRef.current.has(targetSocketId)) {
        const existingPeer = peersRef.current.get(targetSocketId);
        if (existingPeer.connectionState !== "closed") {
          return existingPeer;
        }
      }

      const peer = new RTCPeerConnection(ICE_SERVERS);
      peer._senders = { audio: null, video: null };

      addLocalTracks(peer);

      if (!pendingIceRef.current.has(targetSocketId)) {
        pendingIceRef.current.set(targetSocketId, []);
      }
      if (!pendingLocalIceRef.current.has(targetSocketId)) {
        pendingLocalIceRef.current.set(targetSocketId, []);
      }

      peer.ontrack = (e) => {
        remoteStreamsRef.current.set(targetSocketId, e.streams[0]);
        setParticipants((prev) => {
          if (!prev.includes(targetSocketId)) {
            return [...prev, targetSocketId];
          }
          return prev;
        });
      };

      peer.onicecandidate = (e) => {
        if (!e.candidate) return;
        if (targetSocketId) {
          socket.emit("signal", targetSocketId, e.candidate);
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          toast.success("✅ Connected");
        } else if (peer.connectionState === "failed") {
          toast.error("❌ Connection failed");
        }
      };

      peersRef.current.set(targetSocketId, peer);
      return peer;
    };

    const handleUserJoined = async (userIds, remoteSocketId, userData) => {
      if (remoteSocketId === socket.id) return;

      // Store the name for this user
      if (userData?.userName) {
        participantNamesRef.current.set(remoteSocketId, userData.userName);
      }

      // Get the user's name
      const userName =
        participantNamesRef.current.get(remoteSocketId) ||
        userData?.userName ||
        "A user";
      toast.info(`👋 ${userName} joined the meeting`);

      // Create peers with all existing users
      for (const userId of userIds) {
        if (userId === socket.id) continue;
        const peer = createPeer(userId);
        const pendingLocal = pendingLocalIceRef.current.get(userId) || [];

        if (pendingLocal.length > 0) {
          pendingLocal.forEach((cand) => socket.emit("signal", userId, cand));
          pendingLocalIceRef.current.set(userId, []);
        }

        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit("signal", userId, offer);
        } catch (err) {
          console.error("Error creating offer:", err);
        }
      }

      // Also create peer with the new user
      if (remoteSocketId) {
        const peer = createPeer(remoteSocketId);
        const pendingLocal =
          pendingLocalIceRef.current.get(remoteSocketId) || [];

        if (pendingLocal.length > 0) {
          pendingLocal.forEach((cand) =>
            socket.emit("signal", remoteSocketId, cand),
          );
          pendingLocalIceRef.current.set(remoteSocketId, []);
        }

        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit("signal", remoteSocketId, offer);
        } catch (err) {
          console.error("Error creating offer:", err);
        }
      }
    };

    const handleSignal = async (fromSocketId, data) => {
      const peer = createPeer(fromSocketId);

      if (data.type === "offer") {
        try {
          // Check if we can accept this offer
          if (
            peer.signalingState !== "stable" &&
            peer.signalingState !== "have-local-offer"
          ) {
            return;
          }

          await peer.setRemoteDescription(data);

          const pending = pendingIceRef.current.get(fromSocketId) || [];
          for (const cand of pending) {
            try {
              await peer.addIceCandidate(cand);
            } catch (error) {
              // Ignore ICE candidate errors during negotiation
              void error;
            }
          }
          pendingIceRef.current.set(fromSocketId, []);

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("signal", fromSocketId, answer);

          const pendingLocal =
            pendingLocalIceRef.current.get(fromSocketId) || [];
          pendingLocal.forEach((cand) =>
            socket.emit("signal", fromSocketId, cand),
          );
          pendingLocalIceRef.current.set(fromSocketId, []);
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      } else if (data.type === "answer") {
        try {
          // Check if we're expecting an answer
          if (peer.signalingState !== "have-local-offer") {
            return;
          }

          await peer.setRemoteDescription(data);
          const pending = pendingIceRef.current.get(fromSocketId) || [];
          for (const cand of pending) {
            try {
              await peer.addIceCandidate(cand);
            } catch (error) {
              // Ignore ICE candidate errors during negotiation
              void error;
            }
          }
          pendingIceRef.current.set(fromSocketId, []);
        } catch (err) {
          console.error("Error handling answer:", err);
        }
      } else if (data.candidate || data.sdpMid) {
        try {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(data);
          } else {
            const pending = pendingIceRef.current.get(fromSocketId) || [];
            pending.push(data);
            pendingIceRef.current.set(fromSocketId, pending);
          }
        } catch (err) {
          console.error("Error adding ice candidate", err);
        }
      }
    };

    const handleUserLeft = (socketId) => {
      // Get the participant's name from our map
      const participantName =
        participantNamesRef.current.get(socketId) || "Unknown User";

      toast.warning(`👋 ${participantName} left the meeting`);

      // Clean up the name entry
      participantNamesRef.current.delete(socketId);

      if (peersRef.current.has(socketId)) {
        peersRef.current.get(socketId).close();
        peersRef.current.delete(socketId);
      }
      remoteStreamsRef.current.delete(socketId);
      pendingIceRef.current.delete(socketId);
      pendingLocalIceRef.current.delete(socketId);
      setParticipants((prev) => prev.filter((id) => id !== socketId));
    };

    const handleParticipantList = (list) => {
      // list = [{socketId, name, isHost, joinedAt}, ...]
      setParticipantsList(list);
      hasJoinedRef.current = true;
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      // Store names in map for quick lookup
      participantNamesRef.current.clear();
      list.forEach((p) => {
        participantNamesRef.current.set(p.socketId, p.name || "Unknown User");
      });
    };

    const handleDisconnect = () => {
      if (isLeavingRef.current) {
        return;
      }
      setConnectionStatus("reconnecting");
      toast.warning("⚠️ Connection lost. Attempting to reconnect...", {
        autoClose: false,
        toastId: "reconnecting",
      });
    };

    const handleReconnect = () => {
      setConnectionStatus("connected");
      toast.dismiss("reconnecting");
      toast.success("✅ Reconnected successfully!");
    };

    const handleUserConnectionLost = (data) => {
      const { name } = data;
      toast.info(`⚠️ ${name} has connection issues...`, {
        autoClose: 5000,
      });
    };

    const handleUserReconnected = async (data) => {
      const { oldSocketId, newSocketId, userData } = data;

      // Close old peer connection
      if (peersRef.current.has(oldSocketId)) {
        const oldPeer = peersRef.current.get(oldSocketId);
        oldPeer.close();
        peersRef.current.delete(oldSocketId);
      }

      // Clean up old references
      remoteStreamsRef.current.delete(oldSocketId);
      pendingIceRef.current.delete(oldSocketId);
      pendingLocalIceRef.current.delete(oldSocketId);

      // Remove old participant from UI
      setParticipants((prev) => prev.filter((id) => id !== oldSocketId));

      // Update name map
      const participantName =
        participantNamesRef.current.get(oldSocketId) ||
        userData?.userName ||
        "Participant";
      participantNamesRef.current.delete(oldSocketId);
      participantNamesRef.current.set(
        newSocketId,
        userData?.userName || participantName,
      );

      toast.success(`✅ ${participantName} reconnected!`);

      // Create NEW peer connection with reconnected user
      const peer = createPeer(newSocketId);
      const pendingLocal = pendingLocalIceRef.current.get(newSocketId) || [];

      if (pendingLocal.length > 0) {
        pendingLocal.forEach((cand) =>
          socket.emit("signal", newSocketId, cand),
        );
        pendingLocalIceRef.current.set(newSocketId, []);
      }

      // Send offer to reconnected user to establish new WebRTC connection
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("signal", newSocketId, offer);
      } catch (err) {
        console.error("Error creating offer for reconnected user:", err);
      }
    };

    const handleReconnectionSuccessful = async (data) => {
      setConnectionStatus("connected");
      toast.dismiss("reconnecting");
      toast.success("✅ Session restored!");

      const { otherUsers } = data;

      // Re-establish WebRTC connections with all other users
      if (otherUsers && otherUsers.length > 0) {
        for (const userId of otherUsers) {
          if (userId === socket.id) continue;

          // Create new peer connection
          const peer = createPeer(userId);
          const pendingLocal = pendingLocalIceRef.current.get(userId) || [];

          if (pendingLocal.length > 0) {
            pendingLocal.forEach((cand) => socket.emit("signal", userId, cand));
            pendingLocalIceRef.current.set(userId, []);
          }

          // Send offer to re-establish connection
          try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.emit("signal", userId, offer);
          } catch (err) {
            console.error("Error creating offer during reconnection:", err);
          }
        }
      }
    };

    socket.on("user-joined", handleUserJoined);
    socket.on("signal", handleSignal);
    socket.on("user-left", handleUserLeft);
    socket.on("participant-list", handleParticipantList);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect", handleReconnect);
    socket.on("user-connection-lost", handleUserConnectionLost);
    socket.on("user-reconnected", handleUserReconnected);
    socket.on("reconnection-successful", handleReconnectionSuccessful);

    /* INIT */
    const init = async () => {
      // Prevent duplicate initialization
      if (initializeRef.current) {
        return;
      }

      initializeRef.current = true;

      // Wait for auth to load
      if (authLoading) {
        return;
      }

      if (!user || !user._id) {
        console.error("User not authenticated");
        toast.error("Please login first");
        navigate("/login");
        return;
      }

      if (!socket.connected) {
        socket.connect();
      }

      await startMedia();

      const joinData = {
        meetingCode: meetingCode,
        userId: user._id,
        userName: user.fullname || user.username || "Anonymous",
      };

      // Set meeting code for reconnection tracking
      setMeetingCode(meetingCode);
      markSessionEstablished();

      socket.emit("join-call", joinData);
      setParticipants([]);

      hasJoinedRef.current = false;
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
      }
      joinTimeoutRef.current = setTimeout(() => {
        if (hasJoinedRef.current) return;
        toast.error("Failed to join within 30 seconds. Redirecting...");
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        peersRef.current.forEach((peer) => peer.close());
        peersRef.current.clear();
        clearMeetingCode();
        if (socket.connected) {
          socket.disconnect();
        }
        navigate("/meeting");
      }, 30000);
    };

    // Initialize meeting when auth is ready
    if (!authLoading && !initializeRef.current) {
      init();
    }

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("signal", handleSignal);
      socket.off("user-left", handleUserLeft);
      socket.off("participant-list", handleParticipantList);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect", handleReconnect);
      socket.off("user-connection-lost", handleUserConnectionLost);
      socket.off("user-reconnected", handleUserReconnected);
      socket.off("reconnection-successful", handleReconnectionSuccessful);

      // Only cleanup on unmount, not on re-render
      if (!initializeRef.current) return;

      peersRefCurrent.forEach((peer) => peer.close());
      peersRefCurrent.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      namesRefCurrent.clear();
      clearMeetingCode();
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [meetingCode, authLoading, user, navigate]);

  /* ---------- CONTROLS ---------- */
  const toggleMic = async () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (!track) return;

    const newState = !micOn;
    track.enabled = newState;
    setMicOn(newState);

    peersRef.current.forEach((peer) => {
      if (peer._senders.audio) {
        peer._senders.audio.replaceTrack(newState ? track : null);
      }
    });
  };

  const toggleCamera = async () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    const newState = !cameraOn;
    setCameraOn(newState);
    track.enabled = newState;

    peersRef.current.forEach((peer) => {
      if (peer._senders.video) {
        if (newState) {
          peer._senders.video.replaceTrack(track);
        } else {
          peer._senders.video.replaceTrack(createBlackVideoTrack());
        }
      }
    });
  };

  const leaveMeeting = () => {
    isLeavingRef.current = true;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((peer) => peer.close());
    clearMeetingCode();
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    socket.emit("leave-call", meetingCode, () => {
      if (socket.connected) {
        socket.disconnect();
      }
      navigate("/");
    });
  };

  return (
    <div className="video-page">
      <div className="meeting-header">
        <h2>Meeting: {meetingCode}</h2>
        <div className="header-right">
          {connectionStatus === "reconnecting" && (
            <span className="connection-status reconnecting">
              ⚠️ Reconnecting...
            </span>
          )}
          <span
            className="participant-count clickable"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            title="Click to view participants"
          >
            👥 {participantsList.length}
          </span>
        </div>
      </div>

      <div className="videos-grid">
        {/* Local video */}
        <div className="video-box">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <span>You</span>
        </div>

        {/* Remote videos */}
        {participants.map((socketId) => (
          <div key={socketId} className="video-box">
            <video
              autoPlay
              playsInline
              ref={(video) => {
                if (video && remoteStreamsRef.current.get(socketId)) {
                  video.srcObject = remoteStreamsRef.current.get(socketId);
                }
              }}
            />
            <span>Participant</span>
          </div>
        ))}
      </div>

      <div className="controls-bar">
        <button
          className={`control-btn ${micOn ? "active" : "danger"}`}
          onClick={toggleMic}
        >
          <FontAwesomeIcon icon={micOn ? faMicrophone : faMicrophoneSlash} />
        </button>

        <button
          className={`control-btn ${cameraOn ? "active" : "danger"}`}
          onClick={toggleCamera}
        >
          <FontAwesomeIcon icon={cameraOn ? faVideo : faVideoSlash} />
        </button>

        <button className="control-btn leave" onClick={leaveMeeting}>
          <FontAwesomeIcon icon={faPhoneSlash} />
        </button>
      </div>

      <ParticipantWindow
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        participantsList={participantsList}
      />
    </div>
  );
}

export default VideoMeet;
