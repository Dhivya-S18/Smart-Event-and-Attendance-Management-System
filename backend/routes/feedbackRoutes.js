const express = require("express");
const { submitFeedback, getEventFeedbackExcel, getEventFeedback } = require("../controllers/feedbackController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/submit", submitFeedback); // Public or protected depending on requirement. Allowing without protect if we just verify via email in the controller. But let's add protect if required.
router.get("/excel/:eventId", protect, authorize("student", "staff", "hod", "admin"), getEventFeedbackExcel);
router.get("/:eventId", protect, authorize("staff", "hod", "admin", "student"), getEventFeedback);

module.exports = router;
