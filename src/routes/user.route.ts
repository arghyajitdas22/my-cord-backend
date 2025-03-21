import { Router } from "express";
import { searchUsers } from "../controllers/user.controller";

const router = Router();

router.route("/search").get(searchUsers);

export default router;
