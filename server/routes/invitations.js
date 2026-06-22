import express from "express";
import {
  sendInvitation,
  getMyInvitations,
  respondToInvitation,
} from "../controllers/invitationController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.post("/", sendInvitation);
router.get("/mine", getMyInvitations);
router.put("/:id", respondToInvitation);

export default router;
