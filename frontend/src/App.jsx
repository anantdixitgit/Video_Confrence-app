import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Landing from "./components/Landing/Landing";
import Login from "./components/Authentication/Login";
import Signup from "./components/Authentication/Signup";
import VideoMeet from "./components/VideoMeet/VideoMeet";
import JoinMeeting from "./components/JoinMeet";
import GetMeeting from "./components/getMeeting/getMeeting";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./protectedRoute";
import axios from "axios";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
axios.defaults.withCredentials = true;

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
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
          <Route
            path="/my-meetings"
            element={
              <ProtectedRoute>
                <GetMeeting />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
