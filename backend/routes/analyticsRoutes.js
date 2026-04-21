const express = require("express");
const router = express.Router();

const { getAnalytics, generateCircular, generateCertificate } = require("../controllers/analyticsController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Only Admin can view these analytics
router.get("/", protect, authorizeRoles("admin"), getAnalytics);
router.post("/circulars", protect, authorizeRoles("admin"), generateCircular);
router.post("/certificates", protect, authorizeRoles("admin"), generateCertificate);

module.exports = router;
