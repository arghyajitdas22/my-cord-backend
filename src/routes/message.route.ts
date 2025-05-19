import { Router } from "express";
import { verifyAccessToken } from "../middlewares/auth.middleware";
import {
  deleteAndUpdateMessage,
  getAllMessages,
  sendMessage,
} from "../controllers/message.controller";
import { upload } from "../middlewares/multer.middleware";

const router = Router();

router
  .route("/:chatId")
  .get(verifyAccessToken, getAllMessages)
  .post(verifyAccessToken, upload.array("attachments", 5), sendMessage);

router
  .route("/:chatId/:messageId")
  .patch(verifyAccessToken, deleteAndUpdateMessage);

export default router;
