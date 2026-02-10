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

/* ---------- ICE CONFIG ---------- */
/* ⚠️ For production, generate TURN credentials dynamically */
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:global.turn.twilio.com:3478?transport=udp",
      username: "TWILIO_USERNAME",
      credential: "TWILIO_PASSWORD",
    },
    {
      urls: "turn:global.turn.twilio.com:3478?transport=tcp",
      username: "TWILIO_USERNAME",
      credential: "TWILIO_PASSWORD",
    },
  ],
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
  const pendingLocalIceRef = useRef([]);

  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [message, setMessage] = useState("");

  /* ---------- MESSAGE ---------- */
  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    stream.getAudioTracks().forEach((t) => (t.enabled = false));
    stream.getVideoTracks().forEach((t) => (t.enabled = false));

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  };

  /* ---------- CREATE PEER ---------- */
  const createPeer = () => {
    if (peerRef.current) return peerRef.current;

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    peer._senders = { audio: null, video: null };

    /* Attach local tracks */
    localStreamRef.current.getTracks().forEach((track) => {
      const sender = peer.addTrack(track, localStreamRef.current);
      if (track.kind === "audio") peer._senders.audio = sender;
      if (track.kind === "video") peer._senders.video = sender;
    });

    /* Remote stream */
    peer.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    /* ICE candidate */
    peer.onicecandidate = (e) => {
      if (!e.candidate) return;

      if (remoteSocketIdRef.current) {
        socket.emit("signal", remoteSocketIdRef.current, e.candidate);
      } else {
        pendingLocalIceRef.current.push(e.candidate);
      }
    };

    /* Debug logs */
    peer.onconnectionstatechange = () => {
      console.log("Connection state:", peer.connectionState);
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE state:", peer.iceConnectionState);
    };

    return peer;
  };

  /* ---------- SOCKET + INIT ---------- */
  useEffect(() => {
    socket.on("user-joined", async (socketId, users) => {
      if (socketId === socket.id) return;

      remoteSocketIdRef.current = socketId;
      showMessage("User joined");

      const peer = createPeer();

      if (users.length > 1) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("signal", socketId, offer);
      }
    });

    socket.on("signal", async (fromSocketId, data) => {
      remoteSocketIdRef.current = fromSocketId;
      const peer = createPeer();

      if (data.type === "offer") {
        await peer.setRemoteDescription(data);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("signal", fromSocketId, answer);
      } else if (data.type === "answer") {
        await peer.setRemoteDescription(data);
      } else {
        if (peer.remoteDescription) {
          await peer.addIceCandidate(data);
        } else {
          pendingIceRef.current.push(data);
        }
      }
    });

    socket.on("user-left", () => {
      showMessage("User left");
      peerRef.current?.close();
      peerRef.current = null;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    /* AFTER registering listeners */
    const init = async () => {
      await startMedia();
      createPeer(); // 🔥 important
      socket.emit("join-call", meetingCode);
    };

    init();

    return () => {
      socket.off();
      peerRef.current?.close();
    };
  }, [meetingCode]);

  /* ---------- CONTROLS ---------- */
  const toggleMic = async () => {
    const track = localStreamRef.current.getAudioTracks()[0];
    if (!track) return;

    const newState = !micOn;
    track.enabled = newState;
    setMicOn(newState);

    if (peerRef.current?._senders.audio) {
      await peerRef.current._senders.audio.replaceTrack(
        newState ? track : null,
      );
    }
  };

  const toggleCamera = async () => {
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    const newState = !cameraOn;
    setCameraOn(newState);

    if (peerRef.current?._senders.video) {
      if (newState) {
        track.enabled = true;
        await peerRef.current._senders.video.replaceTrack(track);
      } else {
        track.enabled = false;
        await peerRef.current._senders.video.replaceTrack(
          createBlackVideoTrack(),
        );
      }
    }
  };

  const leaveMeeting = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerRef.current?.close();
    socket.emit("leave-call", meetingCode);
    socket.disconnect();
    navigate("/");
  };

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
