import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./authSplit.css";

function Signup() {
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(
        "http://localhost:5000/api/v1/user/register",
        {
          fullname,
          username,
          password,
        },
      );

      if (res.data.success) {
        alert("Signup successful");
        navigate("/login");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Signup failed");
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Left Section */}
      <div className="auth-left signup-bg">
        <h1>MeetClub</h1>
        <p>
          Create your MeetClub account and start hosting seamless video meetings
          in seconds.
        </p>
      </div>

      {/* Right Section */}
      <div className="auth-right">
        <div className="auth-form-card">
          <h2>Create Account</h2>
          <p className="auth-subtitle">Sign up to get started</p>

          <form onSubmit={handleSignup}>
            <input
              type="text"
              value={fullname}
              placeholder="Full Name"
              className="auth-input"
              onChange={(e) => setFullname(e.target.value)}
              required
            />

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
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
            />

            <button type="submit" className="auth-btn">
              Sign Up
            </button>
          </form>

          <p className="auth-footer">
            Already have an account?{" "}
            <Link to="/login">
              <span>Login</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
