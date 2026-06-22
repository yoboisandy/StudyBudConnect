import express from "express";
import { getMessages, uploadFile } from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(protect);
router.post("/upload", upload.single("file"), uploadFile);
router.get("/:groupId", getMessages);

export default router;
