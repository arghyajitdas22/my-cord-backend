import { Router } from "express";
import { verifyAccessToken } from "../middlewares/auth.middleware";
import {
  createGroupChatInAServer,
  createOrGetAOneOnOneChat,
  getAllGroupChatsInAServer,
  getAllOneToOneChats,
} from "../controllers/chat.controller";

const router = Router();

router.route("/:receiverId").post(verifyAccessToken, createOrGetAOneOnOneChat);
router
  .route("/:serverId")
  .post(verifyAccessToken, createGroupChatInAServer)
  .get(verifyAccessToken, getAllGroupChatsInAServer);
router.route("/").get(verifyAccessToken, getAllOneToOneChats);

export default router;
