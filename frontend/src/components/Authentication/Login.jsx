import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import "./authSplit.css";

function Login() {
  const { isAuthenticated, user, refreshAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      alert("Please fill all fields");
      return;
    }

    try {
      console.log("i am here");
      const res = await axios.post(
        "https://video-confrence-app.onrender.com/api/v1/user/login",
        { username, password },
        {
          withCredentials: true,
        },
      );

      await refreshAuth();

      if (res.data.success) {
        alert("Login successful");
        navigate("/meeting"); // or join-meeting page
      }
    } catch (err) {
      alert(err.response?.data?.message || "Invalid username or password");
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Left Section */}
      <div className="auth-left login-bg">
        <h1>MeetClub</h1>
        <p>
          Connect instantly with secure video and audio meetings. Work together
          from anywhere in the world.
        </p>
      </div>

      {/* Right Section */}
      <div className="auth-right">
        <div className="auth-form-card">
          <h2>Welcome Back</h2>
          <p className="auth-subtitle">Login to your account</p>

          <form onSubmit={handleLogin}>
            <input
              type="text"
              value={username}
              placeholder="Username"
              className="auth-input"
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <input
              type="password"
              value={password}
              placeholder="Password"
              className="auth-input"
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit" className="auth-btn">
              Login
            </button>
          </form>

          <p className="auth-footer">
            Don’t have an account?{" "}
            <Link to="/signup">
              <span>Sign Up</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
