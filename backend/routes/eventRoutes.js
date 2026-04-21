const express = require("express");
const { 
  createEvent, 
  getPublishedEvents, 
  getMyEvents,
  staffApprove, 
  hodApprove, 
  getEventsByStatus,
  registerForEvent,
  sendReminders,
  generateCircularAPI,
  generatePosterAPI,
  createRegistrationForm,
  createFeedbackForm,
  submitToHod,
  getEventRegistrations,
  updateEvent,
  exportAttendance,
  closeEvent,
  toggleRegistration,
  deleteEvent
} = require("../controllers/eventController");
const { generateAndSendCertificates } = require("../controllers/certificateController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { autoUpdateEventStatus } = require("../middleware/eventMiddleware");

const router = express.Router();
router.use(autoUpdateEventStatus);


// Public routes for non-login students
router.get("/published", getPublishedEvents);
router.post("/:id/register", registerForEvent);

// Role-protected routes
router.get("/my-requests", protect, authorize("student"), getMyEvents);
router.post("/create", protect, authorize("student", "staff"), createEvent);
router.put("/:id/staff-approve", protect, authorize("staff"), staffApprove);
router.put("/:id/hod-approve", protect, authorize("hod"), hodApprove);
router.get("/status", protect, authorize("staff", "hod", "admin", "student"), getEventsByStatus);
router.get("/send-reminders", protect, authorize("admin"), sendReminders);
router.post("/:id/create-registration", protect, authorize("student", "staff"), createRegistrationForm);
router.post("/:id/create-feedback", protect, authorize("student", "staff"), createFeedbackForm);
router.post("/:id/generate-circular", protect, authorize("student", "staff"), generateCircularAPI);
router.post("/:id/generate-poster", protect, authorize("student", "staff"), generatePosterAPI);
router.put("/:id/submit-hod", protect, authorize("student", "staff"), submitToHod);
router.put("/:id/update", protect, authorize("student", "staff"), updateEvent);
router.get("/:id/export-attendance", protect, authorize("staff", "student"), exportAttendance);
router.get("/:id/registrations", protect, authorize("staff", "student"), getEventRegistrations);
router.post("/:eventId/generate-certificates", protect, authorize("staff", "student"), generateAndSendCertificates);

router.put("/:id/close", protect, authorize("student", "staff"), closeEvent);
router.put("/:id/toggle-registration", protect, authorize("student", "staff"), toggleRegistration);
router.delete("/:id/delete", protect, authorize("student", "staff", "admin"), deleteEvent);

module.exports = router;
