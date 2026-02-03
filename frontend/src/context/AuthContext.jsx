import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication once (on app load)
  const checkAuth = async () => {
    try {
      const res = await axios.get(
        "https://video-confrence-app.onrender.com/api/v1/user/authenticate",
        { withCredentials: true },
      );

      setIsAuthenticated(true);
      setUser(res.data.user);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Logout helper
  const logout = async () => {
    await axios.post(
      "https://video-confrence-app.onrender.com/api/v1/user/logout",
      {},
      { withCredentials: true },
    );

    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        logout,
        refreshAuth: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook (important)
export const useAuth = () => {
  return useContext(AuthContext);
};
