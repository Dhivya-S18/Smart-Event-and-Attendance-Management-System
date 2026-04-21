const express = require("express");
const { 
    getAnalytics, 
    getAllUsers, 
    updateUser, 
    deleteUser,
    createUser,
    getDepartments,
    createDepartment,
    deleteDepartment,
    getAssociations,
    createAssociation,
    deleteAssociation,
    getAssociationDetails,
    getAdminClubs,
    createClub,
    updateClub,
    deleteClub,
    getAllEvents,
    deleteEvent,
    resendInvitation,
    backfillClubNames
} = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/analytics", protect, authorize("admin"), getAnalytics);
router.get("/users", protect, authorize("admin"), getAllUsers);
router.post("/users", protect, authorize("admin"), createUser);
router.put("/users/:id", protect, authorize("admin"), updateUser);
router.delete("/users/:id", protect, authorize("admin"), deleteUser);
router.post("/users/:userId/resend-invitation", protect, authorize("admin"), resendInvitation);

router.get("/departments", protect, authorize("admin"), getDepartments);
router.post("/departments", protect, authorize("admin"), createDepartment);
router.delete("/departments/:id", protect, authorize("admin"), deleteDepartment);

router.get("/associations", protect, authorize("admin"), getAssociations);
router.post("/associations", protect, authorize("admin"), createAssociation);
router.delete("/associations/:id", protect, authorize("admin"), deleteAssociation);
router.get("/associations/:id", protect, authorize("admin"), getAssociationDetails);

router.get("/clubs", protect, authorize("admin"), getAdminClubs);
router.post("/clubs", protect, authorize("admin"), createClub);
router.put("/clubs/:id", protect, authorize("admin"), updateClub);
router.delete("/clubs/:id", protect, authorize("admin"), deleteClub);

router.get("/events", protect, authorize("admin"), getAllEvents);
router.delete("/events/:id", protect, authorize("admin"), deleteEvent);

// Backfill API
router.get("/backfill", protect, authorize("admin"), backfillClubNames);

// Debug Ram Priya API
router.get("/debug-ram-priya", protect, authorize("admin"), async (req, res) => {
  try {
    const User = require("../models/User");
    const Club = require("../models/Club");
    const Association = require("../models/Association");

    const users = await User.find({ name: { $regex: /Ram Priya/i } });
    let output = [];

    for (const user of users) {
      let data = {
        name: user.name,
        role: user.role,
        id: user._id,
        clubId: user.clubId,
        clubName: user.clubName,
        associationId: user.associationId,
        clubs_where_member: (await Club.find({ members: user._id })).map(c => c.clubName),
        clubs_where_studentCoord: (await Club.find({ studentCoordinators: user._id })).map(c => c.clubName),
        assocs_where_studentCoord: (await Association.find({ studentCoordinators: user._id })).map(a => a.name)
      };
      
      // Auto-fix if missing
      if (!data.clubName && data.assocs_where_studentCoord.length > 0) {
        user.clubName = data.assocs_where_studentCoord[0];
        await user.save();
        data.fixed_dynamically = true;
      }
      
      output.push(data);
    }
    res.json(output);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
