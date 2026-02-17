import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "./authSplit.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

function Signup() {
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // ✅ added
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();

    if (loading) return;

    try {
      setLoading(true);

      const res = await axios.post(
        "https://video-confrence-app-sgrb.vercel.app/api/v1/user/register",
        {
          fullname,
          username,
          password,
        },
      );

      if (res.data.success) {
        toast.success("Signup successful");
        navigate("/login");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-left signup-bg">
        <h1>MeetClub</h1>
        <p>
          Create your MeetClub account and start hosting seamless video meetings
          in seconds.
        </p>
      </div>

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

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Signing Up...
                </>
              ) : (
                "Sign Up"
              )}
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
