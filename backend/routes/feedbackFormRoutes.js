const express = require("express");
const { 
  createFeedbackForm, 
  updateFeedbackForm, 
  publishFeedbackForm, 
  getFeedbackForm,
  getFeedbackQR
} = require("../controllers/feedbackFormController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createFeedbackForm);
router.put("/:id", protect, updateFeedbackForm);
router.put("/:id/publish", protect, publishFeedbackForm);
router.get("/event/:eventId", getFeedbackForm);
router.get("/event/:eventId/qr", protect, getFeedbackQR);

module.exports = router;
