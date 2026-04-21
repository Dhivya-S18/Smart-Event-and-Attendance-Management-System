const express = require("express");
const { 
    loginUser, 
    getMe, 
    forgotPassword, 
    resetPassword,
    getCoordinators,
    acceptInvite,
    requestClubJoin
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/accept-invite", acceptInvite);
router.post("/request-join", requestClubJoin);
router.get("/coordinators", protect, getCoordinators);

module.exports = router;
