const express = require("express");
const { 
    getAllClubs, 
    joinClub, 
    getClubDetails,
    addMemberToClub,
    getClubMembers,
    addStudentCoordinator,
    addStaffCoordinator,
    removeStaffCoordinator,
    getJoinRequests,
    manageJoinRequest,
    getPublicClubs,
    getPublicDepartments,
    toggleRegistration,
    setupJoinForm
} = require("../controllers/clubController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { autoUpdateEventStatus } = require("../middleware/eventMiddleware");

const router = express.Router();
router.use(autoUpdateEventStatus);

router.get("/", protect, getAllClubs);
router.get("/public", getPublicClubs);
router.get("/departments", getPublicDepartments);
router.get("/:id", protect, getClubDetails);
router.post("/:id/join", protect, joinClub);
router.post("/:id/toggle-registration", protect, authorize("staff", "admin"), toggleRegistration);
router.post("/:id/join-form", protect, authorize("staff", "admin"), setupJoinForm);

// Member Management
router.post("/:id/members", protect, authorize("staff", "admin"), addMemberToClub);
router.get("/:id/members", protect, authorize("staff", "admin"), getClubMembers);
router.post("/:id/coordinators", protect, authorize("staff", "admin"), addStudentCoordinator);
router.post("/:id/staff", protect, authorize("staff", "admin"), addStaffCoordinator);
router.delete("/:id/staff", protect, authorize("admin"), removeStaffCoordinator);

// Join Request Management
router.get("/:id/requests", protect, authorize("staff", "admin"), getJoinRequests);
router.post("/:id/requests/manage", protect, authorize("staff", "admin"), manageJoinRequest);

module.exports = router;
