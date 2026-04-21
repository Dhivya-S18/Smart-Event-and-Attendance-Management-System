const Association = require("../models/Association");
const User = require("../models/User");

const getMyAssociation = async (req, res) => {
  try {
    const userId = req.user.id;
    const association = await Association.findOne({
      $or: [{ hodId: userId }, { staffCoordinators: userId }]
    }).populate("hodId", "name email")
      .populate("staffCoordinators", "name email")
      .populate("studentCoordinators", "name email registerNumber department")
      .populate("departmentId", "name");

    if (!association) {
      return res.status(404).json({ message: "No association found for your account." });
    }

    res.json(association);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addStudentCoordinator = async (req, res) => {
  try {
    const { email } = req.body;
    const associationId = req.params.id;

    // 1. Verify Association & Perms
    const association = await Association.findById(associationId);
    if (!association) return res.status(404).json({ message: "Association not found" });

    const isAuthorized = association.hodId.toString() === req.user.id || 
                         association.staffCoordinators.includes(req.user.id);
    
    if (!isAuthorized) {
      return res.status(403).json({ message: "Not authorized to manage this association team." });
    }

    // 2. Find or Create Student
    let student = await User.findOne({ email });

    const crypto = require("crypto");
    const sendEmail = require("../utils/emailSender");

    if (!student) {
      student = await User.create({
        name: "Pending Student",
        email,
        password: crypto.randomBytes(8).toString("hex"),
        role: "student"
      });
    } else if (student.role !== "student") {
      return res.status(400).json({ message: "User is not a student" });
    }

    // 3. Link Student
    if (association.studentCoordinators.includes(student._id)) {
      return res.status(400).json({ message: "Student is already a coordinator for this association." });
    }

    association.studentCoordinators.push(student._id);
    await association.save();

    const inviteToken = crypto.randomBytes(20).toString("hex");
    student.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
    student.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
    
    student.associationId = association._id;
    student.clubName = association.name; 
    await student.save();

    const setupUrl = `${process.env.FRONTEND_URL}/accept-invite.html?token=${inviteToken}`;
    await sendEmail({
      email: student.email,
      subject: `Student Coordinator Assignment: ${association.name}`,
      message: `Hello, you have been assigned as a Student Coordinator for the ${association.name} association.\n\nPlease complete your registration and set your password using the link below:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
    });

    res.json({ message: "Student coordinator invited/added successfully!", student });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeStudentCoordinator = async (req, res) => {
  try {
    const { studentId } = req.body;
    const associationId = req.params.id;

    const association = await Association.findById(associationId);
    if (!association) return res.status(404).json({ message: "Association not found" });

    // Verify perms
    const isAuthorized = association.hodId.toString() === req.user.id || 
                         association.staffCoordinators.includes(req.user.id);
    if (!isAuthorized) return res.status(403).json({ message: "Unauthorized" });

    // Remove from array
    association.studentCoordinators = association.studentCoordinators.filter(id => id.toString() !== studentId);
    await association.save();

    // Update student
    const student = await User.findById(studentId);
    if (student) {
      student.associationId = undefined;
      student.clubName = undefined; 
      await student.save();
    }

    res.json({ message: "Coordinator removed." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMyAssociation, addStudentCoordinator, removeStudentCoordinator };
