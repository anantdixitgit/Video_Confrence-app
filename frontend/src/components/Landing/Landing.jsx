import React, { useEffect, useState } from "react";
import "./landing.css";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

function Landing() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check login status on page load
  useEffect(() => {
    axios
      .get(
        "https://video-confrence-app.onrender.com/api/v1/user/authenticate",
        {
          withCredentials: true,
        },
      )
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false));
  }, []);

  const handleGetStarted = async () => {
    try {
      await axios.get(
        "https://video-confrence-app.onrender.com/api/v1/user/authenticate",
        {
          withCredentials: true,
        },
      );

      navigate("/meeting");
    } catch {
      navigate("/login");
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(
        "https://video-confrence-app.onrender.com/api/v1/user/logout",
        {},
        { withCredentials: true },
      );

      setIsLoggedIn(false);
      navigate("/login");
    } catch {
      alert("Logout failed");
    }
  };

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-left">
          <span className="logo">MeetClub</span>
        </div>

        <div className="nav-right">
          {isLoggedIn ? (
            <>
              <Link to="/meeting">
                <button className="nav-btn">Join Meeting</button>
              </Link>

              <button className="nav-btn outline" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="nav-btn outline">Login</button>
              </Link>

              <Link to="/signup">
                <button className="nav-btn primary">Sign Up</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="overlay">
        <div className="landing-content">
          <h1 className="landing-title">Seamless Video & Audio Conferencing</h1>

          <p className="landing-subtitle">
            Crystal-clear video calls and reliable audio meetings — connect,
            collaborate, and communicate effortlessly from anywhere.
          </p>

          <button className="get-started-btn" onClick={handleGetStarted}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

export default Landing;
