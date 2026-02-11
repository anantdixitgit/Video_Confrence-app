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
/* ---------- ICE CONFIG ---------- */
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
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
    }
  };

  /* ---------- ADD LOCAL TRACKS ---------- */
  const addLocalTracks = (peer) => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getTracks().forEach((track) => {
      // Check if track already added
      const senders = peer.getSenders();
      const alreadyAdded = senders.some(player => player.track === track);

      if (!alreadyAdded) {
        const sender = peer.addTrack(track, localStreamRef.current);
        if (track.kind === "audio") peer._senders.audio = sender;
        if (track.kind === "video") peer._senders.video = sender;
      }
    });
  }

  /* ---------- CREATE PEER ---------- */
  const createPeer = (targetSocketId) => {
    // If peer exists and is not closed, return it. 
    // BUT we need to be careful about state. 
    // Simplest approach for 1:1: close existing if different user (not handled here but assumes 1:1)
    if (peerRef.current) {
      if (peerRef.current.connectionState !== 'closed') {
        return peerRef.current;
      }
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;
    peer._senders = { audio: null, video: null };

    // Attach local tracks
    addLocalTracks(peer);

    // Remote stream
    peer.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    // ICE candidate
    peer.onicecandidate = (e) => {
      if (!e.candidate) return;

      if (targetSocketId) {
        socket.emit("signal", targetSocketId, e.candidate);
      } else {
        pendingLocalIceRef.current.push(e.candidate);
      }
    };

    // Connection state
    peer.onconnectionstatechange = () => {
      console.log("Connection state:", peer.connectionState);
      if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        // Optional: handle retry or cleanup
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE state:", peer.iceConnectionState);
    };

    return peer;
  };

  /* ---------- SOCKET + INIT ---------- */
  useEffect(() => {

    const handleUserJoined = async (socketId, users) => {
      if (socketId === socket.id) return;

      console.log("User joined:", socketId);
      remoteSocketIdRef.current = socketId;
      showMessage("User joined");

      // Cleanup separate peer if needed (though we assume 1:1)
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      const peer = createPeer(socketId);

      // Flush local candidates now that we know who to send to
      if (pendingLocalIceRef.current.length > 0) {
        pendingLocalIceRef.current.forEach(candidate => {
          socket.emit("signal", socketId, candidate);
        });
        pendingLocalIceRef.current = [];
      }

      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("signal", socketId, offer);
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    };

    const handleSignal = async (fromSocketId, data) => {
      remoteSocketIdRef.current = fromSocketId;
      const peer = createPeer(fromSocketId);

      if (data.type === "offer") {
        try {
          await peer.setRemoteDescription(data);

          // FLUSH PENDING ICE
          if (pendingIceRef.current.length > 0) {
            for (const candidate of pendingIceRef.current) {
              await peer.addIceCandidate(candidate);
            }
            pendingIceRef.current = [];
          }

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("signal", fromSocketId, answer);

          // Flush local candidates
          if (pendingLocalIceRef.current.length > 0) {
            pendingLocalIceRef.current.forEach(candidate => {
              socket.emit("signal", fromSocketId, candidate);
            });
            pendingLocalIceRef.current = [];
          }

        } catch (err) {
          console.error("Error handling offer:", err);
        }
      } else if (data.type === "answer") {
        try {
          await peer.setRemoteDescription(data);
          // FLUSH PENDING ICE
          if (pendingIceRef.current.length > 0) {
            for (const candidate of pendingIceRef.current) {
              await peer.addIceCandidate(candidate);
            }
            pendingIceRef.current = [];
          }
        } catch (err) {
          console.error("Error handling answer:", err);
        }
      } else if (data.candidate || data.sdpMid) { // ICE Candidate
        try {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(data);
          } else {
            pendingIceRef.current.push(data);
          }
        } catch (err) {
          console.error("Error adding ice candidate", err);
        }
      }
    };

    const handleUserLeft = () => {
      showMessage("User left");
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      remoteSocketIdRef.current = null;
      pendingIceRef.current = [];
      pendingLocalIceRef.current = [];
    };

    socket.on("user-joined", handleUserJoined);
    socket.on("signal", handleSignal);
    socket.on("user-left", handleUserLeft);

    /* INIT */
    const init = async () => {
      // Connect socket manually
      if (!socket.connected) {
        socket.connect();
      }

      await startMedia();
      socket.emit("join-call", meetingCode);
    };

    init();

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("signal", handleSignal);
      socket.off("user-left", handleUserLeft);

      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      // Disconnect socket to prevent ghost connections
      if (socket.connected) {
        socket.disconnect();
      }
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
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    const newState = !cameraOn;
    setCameraOn(newState);

    if (newState) {
      track.enabled = true;
      localVideoRef.current.srcObject = localStreamRef.current;
    } else {
      track.enabled = false;
    }

    if (peerRef.current?._senders.video) {
      if (newState) {
        await peerRef.current._senders.video.replaceTrack(track);
      } else {
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
