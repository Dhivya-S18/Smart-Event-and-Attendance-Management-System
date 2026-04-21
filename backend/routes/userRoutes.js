const express = require("express");
const router = express.Router();

const { registerUser, loginUser, getUsers, forgotPassword, resetPassword, updateProfile, getProfile } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

router.post("/register", registerUser);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:resetToken", resetPassword);

// Profile routes
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

// Explicitly placing it under protect to ensure only Admins can query user lists
router.get("/", protect, authorize("admin"), getUsers);

module.exports = router;
