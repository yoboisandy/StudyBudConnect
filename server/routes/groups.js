import express from "express";
import {
  createGroup,
  getGroups,
  getMyGroups,
  getGroupById,
  joinGroup,
  updateGroup,
  removeMember,
  getJoinRequests,
  respondToJoinRequest,
} from "../controllers/groupController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/", getGroups);
router.post("/", createGroup);
router.get("/mine", getMyGroups);
router.get("/:id", getGroupById);
router.put("/:id", updateGroup);
router.post("/:id/join", joinGroup);
router.get("/:id/join-requests", getJoinRequests);
router.delete("/:id/members/:userId", removeMember);
router.post("/:id/join-requests/respond", respondToJoinRequest);

export default router;
