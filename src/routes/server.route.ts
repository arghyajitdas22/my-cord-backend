import { Router } from "express";
import {
  addMembersToServer,
  changeMemberRole,
  createServer,
  removeMemeberFromServer,
} from "../controllers/server.controller";
import { verifyAccessToken } from "../middlewares/auth.middleware";
import router from "./healthcheck.route";
import { upload } from "../middlewares/multer.middleware";

router
  .route("/")
  .post(verifyAccessToken, upload.single("avatar"), createServer);

router
  .route("/add-members/:serverId")
  .patch(verifyAccessToken, addMembersToServer);

router
  .route("/change-role/:serverId")
  .patch(verifyAccessToken, changeMemberRole);

router
  .route("/remove-member/:serverId")
  .patch(verifyAccessToken, removeMemeberFromServer);

export default router;
