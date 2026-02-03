import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../../utils/socket";
import "./VideoMeet.css";

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

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const pendingIceRef = useRef([]);

  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [message, setMessage] = useState("");

  /* ---------- helpers ---------- */
  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  /* ---------- media ---------- */
  const startMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // start OFF (same behavior as before)
    stream.getAudioTracks().forEach((t) => (t.enabled = false));
    stream.getVideoTracks().forEach((t) => (t.enabled = false));

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;
  };

  /* ---------- peer ---------- */
  const createPeer = async () => {
    if (peerRef.current) return;

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    peer.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
    };

    peer.onicecandidate = (e) => {
      if (e.candidate && remoteSocketIdRef.current) {
        socket.emit("signal", remoteSocketIdRef.current, {
          type: "candidate",
          candidate: e.candidate,
        });
      }
    };

    localStreamRef.current.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current);
    });
  };

  /* ---------- socket ---------- */
  useEffect(() => {
    const init = async () => {
      await startMedia();
      socket.emit("join-call", meetingCode);
    };

    init();

    socket.on("user-joined", async (socketId, users) => {
      if (socketId === socket.id) return;

      remoteSocketIdRef.current = socketId;
      showMessage("User joined");

      await createPeer();

      // ONLY first user creates offer (no race condition)
      if (users.length === 2 && socket.id === users[0]) {
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socket.emit("signal", socketId, offer);
      }
    });

    socket.on("signal", async (fromSocketId, data) => {
      remoteSocketIdRef.current = fromSocketId;
      await createPeer();

      if (data.type === "offer") {
        await peerRef.current.setRemoteDescription(data);

        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("signal", fromSocketId, answer);

        pendingIceRef.current.forEach(async (c) => {
          await peerRef.current.addIceCandidate(c);
        });
        pendingIceRef.current = [];
      }

      if (data.type === "answer") {
        await peerRef.current.setRemoteDescription(data);

        pendingIceRef.current.forEach(async (c) => {
          await peerRef.current.addIceCandidate(c);
        });
        pendingIceRef.current = [];
      }

      if (data.type === "candidate") {
        const candidate = new RTCIceCandidate(data.candidate);
        if (peerRef.current.remoteDescription) {
          await peerRef.current.addIceCandidate(candidate);
        } else {
          pendingIceRef.current.push(candidate);
        }
      }
    });

    socket.on("user-left", () => {
      showMessage("User left");
      peerRef.current?.close();
      peerRef.current = null;
      remoteVideoRef.current.srcObject = null;
    });

    return () => socket.off();
  }, [meetingCode]);

  /* ---------- controls ---------- */
  const toggleMic = () => {
    const track = localStreamRef.current.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCamera = () => {
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  };

  const leaveMeeting = () => {
    localStreamRef.current.getTracks().forEach((t) => t.stop());
    peerRef.current?.close();
    socket.emit("leave-call", meetingCode);
    socket.disconnect();
    navigate("/");
  };

  /* ---------- UI ---------- */
  return (
    <div className="video-page">
      <h3>Meeting ID: {meetingCode}</h3>

      {message && <div className="toast">{message}</div>}

      <div className="videos">
        <div className="video-box">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <span>You</span>
        </div>

        <div className="video-box">
          <video ref={remoteVideoRef} autoPlay playsInline />
          <span>Participant</span>
        </div>
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
    </div>
  );
}

export default VideoMeet;
