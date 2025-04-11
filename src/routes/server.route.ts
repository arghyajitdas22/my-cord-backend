import { Router } from "express";
import { createServer } from "../controllers/server.controller";
import { verifyAccessToken } from "../middlewares/auth.middleware";
import router from "./healthcheck.route";
import { upload } from "../middlewares/multer.middleware";

router
  .route("/")
  .post(verifyAccessToken, upload.single("avatar"), createServer);

export default router;
