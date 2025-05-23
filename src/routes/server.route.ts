import { Router } from "express";
import {
  addMembersToServer,
  changeMemberRole,
  createServer,
  getAllServers,
  removeMemberFromServer,
} from "../controllers/server.controller";
import { verifyAccessToken } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/multer.middleware";

const router = Router();

router
  .route("/")
  .post(verifyAccessToken, upload.single("avatar"), createServer)
  .get(verifyAccessToken, getAllServers);

// router.route("/get-all-servers").get(verifyAccessToken, getAllServers);

router
  .route("/add-members/:serverId")
  .patch(verifyAccessToken, addMembersToServer);

router
  .route("/change-role/:serverId")
  .patch(verifyAccessToken, changeMemberRole);

router
  .route("/remove-member/:serverId")
  .patch(verifyAccessToken, removeMemberFromServer);

export default router;
