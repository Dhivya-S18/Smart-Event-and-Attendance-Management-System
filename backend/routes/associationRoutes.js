const express = require("express");
const { getMyAssociation, addStudentCoordinator, removeStudentCoordinator } = require("../controllers/associationController");
const { addStaffCoordinator, removeStaffCoordinator } = require("../controllers/clubController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/my-team", protect, authorize("hod", "staff"), getMyAssociation);
router.post("/:id/students", protect, authorize("hod", "staff"), addStudentCoordinator);
router.post("/:id/staff", protect, authorize("hod", "staff", "admin"), addStaffCoordinator);
router.delete("/:id/staff", protect, authorize("admin"), removeStaffCoordinator);
router.delete("/:id/students", protect, authorize("hod", "staff"), removeStudentCoordinator);

module.exports = router;
