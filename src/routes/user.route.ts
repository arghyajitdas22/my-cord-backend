import { Router } from "express";
import { searchUsers, sendFriendRequest } from "../controllers/user.controller";
import { verifyAccessToken } from "../middlewares/auth.middleware";

const router = Router();

router.route("/search").get(verifyAccessToken, searchUsers);
router
  .route("/send-friend-request/:receiverId")
  .post(verifyAccessToken, sendFriendRequest);

export default router;
