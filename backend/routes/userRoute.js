import express from "express";
import verifyJWT from "../Middleware/Auth.middleware.js";
import {
  register,
  login,
  logout,
  isAuthenticated,
} from "../controller/userController.js";
const Router = express.Router();

Router.route("/register").post(register);
Router.route("/login").post(login);
Router.route("/logout").post(logout);
Router.route("/authenticate").get(verifyJWT, isAuthenticated);

export default Router;
