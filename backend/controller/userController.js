import User from "../Models/userSchema.js";

export const register = async (req, res) => {
  try {
    const { fullname, username, password } = req.body;
    if (!fullname || !username || !password) {
      return res.status(400).json({
        message: "something is missing",
        success: false,
      });
    }

    //const file = req.file;

    const user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({
        message: "User already exist with this Username",
        success: false,
      });
    }
    const newUser = new User({ fullname, username, password });
    const createdUser = await newUser.save();

    return res.status(201).json({
      message: "Account created successfully",
      success: true,
    });
  } catch (error) {
    console.error("[Register] error:", error);
    return res.status(500).json({
      message: "error is saving user in database",
      error,
      success: false,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(username, password);

    if (!username || !password) {
      return res.status(400).json({
        message: "something is missing",
        success: false,
      });
    }

    const user = await User.findOne({ username });
    console.log(user);
    if (!user) {
      return res.status(400).json({
        message: "Incorrect Username or password",
        success: false,
      });
    }

    const isPasswordMatch = await user.isPasswordCorrect(password);
    console.log(isPasswordMatch);

    if (!isPasswordMatch) {
      console.log("[LOGIN] Password mismatch");
      return res.status(400).json({
        message: "Incorrect Username or password",
        success: false,
      });
    }

    const token = user.generateAccessToken();

    const loggedInUser = await User.findOne({ username }).select("-password");

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.status(200).json({
      message: `welcome back ${loggedInUser.fullname}`,
      loggedInUser,
      success: true,
    });
    return;
  } catch (error) {
    res.status(500).json({
      error,
      message: "error in login the user",
      success: false,
    });
  }
};

export const logout = async (req, res) => {
  try {
    // Clear cookie for all possible domains and paths
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    // No domain option if COOKIE_DOMAIN is not set
    return res.status(200).json({
      message: "Logged out successfully.",
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
};

export const isAuthenticated = async (req, res) => {
  res.json({
    success: true,
    message: "user-Authenticated",
    user: req.user,
  });
};
