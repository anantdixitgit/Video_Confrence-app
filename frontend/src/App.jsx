import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Landing from "./components/Landing/Landing";
import Login from "./components/Authentication/Login";
import Signup from "./components/Authentication/Signup";
import VideoMeet from "./components/VideoMeet/VideoMeet";
import JoinMeeting from "./components/JoinMeet";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./protectedRoute";
import axios from "axios";
axios.defaults.withCredentials = true;

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/meeting"
            element={
              <ProtectedRoute>
                <JoinMeeting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meet/:meetingCode"
            element={
              <ProtectedRoute>
                <VideoMeet />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
