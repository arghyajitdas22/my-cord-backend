import { Router } from "express";
import {
  getAllFriends,
  searchUsers,
  sendFriendRequest,
  updateFriendRequestStatus,
} from "../controllers/user.controller";
import { verifyAccessToken } from "../middlewares/auth.middleware";

const router = Router();

router.route("/search").get(verifyAccessToken, searchUsers);
router
  .route("/send-friend-request/:receiverId")
  .post(verifyAccessToken, sendFriendRequest);
router
  .route("/change-friend-request-status/:requestId")
  .patch(verifyAccessToken, updateFriendRequestStatus);
router.route("/getAllFriends").get(verifyAccessToken, getAllFriends);

export default router;
