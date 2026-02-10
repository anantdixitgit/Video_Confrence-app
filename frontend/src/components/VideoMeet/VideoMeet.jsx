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
  iceServers: [
    { urls: "stun:global.stun.twilio.com:3478" },
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
  const createOfferPendingRef = useRef(false);

  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [message, setMessage] = useState("");

  /* ---------- helpers ---------- */
  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const createBlackVideoTrack = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const stream = canvas.captureStream();
    return stream.getVideoTracks()[0];
  };

  /* ---------- media ---------- */
  const startMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // start mic & camera OFF
    stream.getAudioTracks().forEach((t) => (t.enabled = false));
    stream.getVideoTracks().forEach((t) => (t.enabled = false));

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;
  };

  /* ---------- peer ---------- */
  const createPeer = async (createOffer = false) => {
    if (peerRef.current) return;

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    peer._senders = { audio: null, video: null };

    localStreamRef.current.getTracks().forEach((track) => {
      const sender = peer.addTrack(track, localStreamRef.current);
      if (track.kind === "audio") peer._senders.audio = sender;
      if (track.kind === "video") peer._senders.video = sender;
    });

    peer.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
    };

    peer.onicecandidate = (e) => {
      if (!e.candidate) return;

      if (remoteSocketIdRef.current) {
        socket.emit("signal", remoteSocketIdRef.current, e.candidate);
      } else {
        pendingLocalIceRef.current.push(e.candidate);
      }
    };

    if (createOffer) {
      if (!remoteSocketIdRef.current) {
        createOfferPendingRef.current = true;
      } else {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("signal", remoteSocketIdRef.current, offer);
      }
    }
  };

  /* ---------- socket ---------- */
  useEffect(() => {
    const init = async () => {
      await startMedia();
      socket.emit("join-call", meetingCode);
    };

    init();

    socket.on("user-joined", (socketId, users) => {
      if (socketId === socket.id) return;
      remoteSocketIdRef.current = socketId;
      if (pendingLocalIceRef.current.length > 0) {
        pendingLocalIceRef.current.forEach((c) =>
          socket.emit("signal", remoteSocketIdRef.current, c),
        );
        pendingLocalIceRef.current = [];
      }
      showMessage("User joined");

      if (users.length > 1) {
        createPeer(true); // second user creates offer
      }
    });

    socket.on("signal", async (fromSocketId, data) => {
      remoteSocketIdRef.current = fromSocketId;

      if (pendingLocalIceRef.current.length > 0) {
        pendingLocalIceRef.current.forEach((c) =>
          socket.emit("signal", remoteSocketIdRef.current, c),
        );
        pendingLocalIceRef.current = [];
      }

      if (createOfferPendingRef.current && peerRef.current) {
        createOfferPendingRef.current = false;
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socket.emit("signal", remoteSocketIdRef.current, offer);
      }

      if (!peerRef.current) {
        await createPeer(false);
      }

      if (data.type === "offer") {
        await peerRef.current.setRemoteDescription(data);
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("signal", fromSocketId, answer);

        pendingIceRef.current.forEach((c) =>
          peerRef.current.addIceCandidate(c),
        );
        pendingIceRef.current = [];
      } else if (data.type === "answer") {
        await peerRef.current.setRemoteDescription(data);
        pendingIceRef.current.forEach((c) =>
          peerRef.current.addIceCandidate(c),
        );
        pendingIceRef.current = [];
      } else {
        if (peerRef.current.remoteDescription) {
          await peerRef.current.addIceCandidate(data);
        } else {
          pendingIceRef.current.push(data);
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
        const blackTrack = createBlackVideoTrack();
        await peerRef.current._senders.video.replaceTrack(blackTrack);
      }
    }
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

      {/* 🎛 Floating Controls */}
      <div className="controls-bar">
        <button
          className={`control-btn ${micOn ? "active" : "danger"}`}
          onClick={toggleMic}
          title={micOn ? "Mute mic" : "Unmute mic"}
        >
          <FontAwesomeIcon icon={micOn ? faMicrophone : faMicrophoneSlash} />
        </button>

        <button
          className={`control-btn ${cameraOn ? "active" : "danger"}`}
          onClick={toggleCamera}
          title={cameraOn ? "Turn camera off" : "Turn camera on"}
        >
          <FontAwesomeIcon icon={cameraOn ? faVideo : faVideoSlash} />
        </button>

        <button
          className="control-btn leave"
          onClick={leaveMeeting}
          title="Leave meeting"
        >
          <FontAwesomeIcon icon={faPhoneSlash} />
        </button>
      </div>
    </div>
  );
}

export default VideoMeet;
