import express from "express";
import verifyJWT, {
  verifyJWTAndLoadUser,
} from "../Middleware/Auth.middleware.js";
import { cacheMiddleware } from "../Middleware/cacheMiddleware.js";
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
Router.route("/authenticate").get(
  verifyJWTAndLoadUser,
  cacheMiddleware(10),
  isAuthenticated,
);

export default Router;
