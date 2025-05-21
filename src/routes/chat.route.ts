import { Router } from "express";
import { verifyAccessToken } from "../middlewares/auth.middleware";
import {
  addParticipantToGroupChat,
  createGroupChatInAServer,
  createOrGetAOneOnOneChat,
  deleteGroupChat,
  getAllGroupChatsInAServer,
  getAllOneToOneChats,
  getGroupChatDetails,
  leaveGroupChat,
  removeParticipantFromGroupChat,
  renameGroupChat,
} from "../controllers/chat.controller";

const router = Router();

router.route("/:receiverId").post(verifyAccessToken, createOrGetAOneOnOneChat);
router
  .route("/:serverId")
  .post(verifyAccessToken, createGroupChatInAServer)
  .get(verifyAccessToken, getAllGroupChatsInAServer);
router.route("/").get(verifyAccessToken, getAllOneToOneChats);
router
  .route("/:serverId/:chatId")
  .get(verifyAccessToken, getGroupChatDetails)
  .patch(verifyAccessToken, renameGroupChat)
  .delete(verifyAccessToken, deleteGroupChat);
router
  .route("/leave-group/:serverId/:chatId")
  .patch(verifyAccessToken, leaveGroupChat);
router
  .route("/remove-group-participant/:serverId/:chatId")
  .patch(verifyAccessToken, removeParticipantFromGroupChat);
router
  .route("/add-participant-to-group/:serverId/:chatId")
  .patch(verifyAccessToken, addParticipantToGroupChat);

export default router;
