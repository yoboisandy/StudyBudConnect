import express from "express";
import {
  getProfile,
  updateProfile,
  getMatches,
  searchUsers,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.get("/me", getProfile);
router.put("/me", updateProfile);
router.get("/matches", getMatches);
router.get("/search", searchUsers);

export default router;
