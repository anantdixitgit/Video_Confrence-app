import jwt from "jsonwebtoken";
import User from "../Models/userSchema.js";

export const verifyJWT = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        message: "unauthorised access",
        success: false,
      });
    }

    const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

    if (!decodedToken) {
      return res.status(401).json({
        message: "Invalid token",
        success: false,
      });
    }

    req._id = decodedToken._id;
    req.user = {
      _id: decodedToken._id,
      username: decodedToken.username,
    };
    next();
  } catch (error) {
    console.error("Auth verification error:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
      success: false,
    });
  }
};

export const verifyJWTAndLoadUser = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        message: "unauthorised access",
        success: false,
      });
    }

    const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

    if (!decodedToken) {
      return res.status(401).json({
        message: "Invalid token",
        success: false,
      });
    }

    const user = await User.findById(decodedToken._id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "user not found",
        success: false,
      });
    }

    req._id = decodedToken._id;
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth verification error:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
      success: false,
    });
  }
};

export default verifyJWT;
