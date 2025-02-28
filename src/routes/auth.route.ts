import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshTokens,
} from "../controllers/auth.controller";
import { verifyAccessToken } from "../middlewares/auth.middleware";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(verifyAccessToken, refreshTokens);

export default router;
