import express from "express";
import { getMessages } from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/:groupId", getMessages);

export default router;
