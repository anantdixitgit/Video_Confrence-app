import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "./authSplit.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

function Login() {
  const { refreshAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // ✅ added
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      toast.warning("Please fill all fields");
      return;
    }

    if (loading) return; // ✅ prevent double click

    try {
      setLoading(true); // ✅ start loader

      const res = await axios.post(
        "http://localhost:5000/api/v1/user/login",
        { username, password },
        {
          withCredentials: true,
        },
      );

      await refreshAuth();

      if (res.data.success) {
        toast.success("Login successful");
        navigate("/meeting");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid username or password");
    } finally {
      setLoading(false); // ✅ stop loader
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
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
            />

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Logging in...
                </>
              ) : (
                "Login"
              )}
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
