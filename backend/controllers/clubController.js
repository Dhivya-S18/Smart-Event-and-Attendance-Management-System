const Club = require("../models/Club");
const User = require("../models/User");
const Event = require("../models/Event");
const Association = require("../models/Association");
const Department = require("../models/Department");
const crypto = require("crypto");
const sendEmail = require("../utils/emailSender");

const getPublicClubs = async (req, res) => {
  try {
    const clubs = await Club.find({ isPublishedForRegistration: true })
      .select("clubName clubType membershipType isPaidMembership membershipFee departmentIds description");
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPublicDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;
    
    // Verify staff has access to this club
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ message: "Club not found" });
    
    if (req.user.role !== 'admin' && !club.staffCoordinators.includes(req.user._id)) {
        return res.status(403).json({ message: "Not authorized to manage this club" });
    }

    club.isPublishedForRegistration = isPublished;
    await club.save();

    res.json({ 
        message: isPublished ? "Club published for registration" : "Club unpublished",
        isPublished: club.isPublishedForRegistration 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllClubs = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'hod') {
      // HODs only see clubs they are assigned to. 
      query.hods = req.user._id;
    } else if (req.user.role === 'staff') {
      query.staffCoordinators = req.user._id;
    } else if (req.user.role === 'student') {
      // Students see all clubs to allow them to browse and join
      query = {};
    }

    const clubs = await Club.find(query)
      .populate("staffCoordinators", "name email department")
      .populate("studentCoordinators", "name email department registerNumber")
      .populate("members", "name email department registerNumber");

    // Add user's join request status for each club
    const formattedClubs = clubs.map(c => {
        const club = c.toObject();
        const myRequest = (club.joinRequests || []).find(req => req.studentId.toString() === req.user?._id.toString());
        club.myRequestStatus = myRequest ? myRequest.status : null;
        return club;
    });

    res.json(formattedClubs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getClubDetails = async (req, res) => {
  try {
    let club = await Club.findById(req.params.id)
      .populate("staffCoordinators", "name email department")
      .populate("studentCoordinators", "name email department registerNumber")
      .populate("members", "name email department registerNumber")
      .populate("hods", "name email department")
      .populate("departmentIds", "name");
    
    let isAssociation = false;
    if (!club) {
      const Association = require("../models/Association");
      const association = await Association.findById(req.params.id)
        .populate("staffCoordinators", "name email department")
        .populate("studentCoordinators", "name email department registerNumber")
        .populate("hodId", "name email department")
        .populate("departmentId", "name");

      if (!association) return res.status(404).json({ message: "Organization not found" });

      // Map association to look like a club for dashboard compatibility
      club = {
        _id: association._id,
        clubName: association.name,
        department: association.departmentId?.name || "Association",
        role: 'association',
        members: [] // Associations don't have general members in the same way yet
      };
      isAssociation = true;
    }

    // Security Check
    if (req.user.role === 'staff' && !isAssociation && !club.staffCoordinators.some(c => c._id.toString() === req.user._id.toString())) {
      // return res.status(403).json({ message: "Not authorized to access this club" });
    }

    // Fetch categorized events
    const eventQuery = isAssociation ? { associationId: club._id } : { clubId: club._id };
    const events = await Event.find(eventQuery).sort({ date: -1 });

    
    // pending: anything that hasn't reached final publication yet but isn't rejected
    const pending = events.filter(e => 
      e.status === 'pending_staff_approval' || 
      e.status === 'circular_creation_pending' || 
      e.status === 'pending_hod_approval'
    );
    
    // approved: staff has approved it, but it might not be published yet (e.g. pending HOD or circular)
    const approved = events.filter(e => e.staffApproved === true && e.status !== 'published' && e.status !== 'rejected' && e.status !== 'completed'); 
    
    // published: fully live and upcoming
    const published = events.filter(e => e.status === 'published');

    // completed: finished events
    const completed = events.filter(e => e.status === 'completed');

    res.json({
      club,
      events: {
        pending,
        approved,
        published,
        completed,
        all: events
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addMemberToClub = async (req, res) => {
  try {
    const { registerNumber } = req.body;
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    // Authorization: only staff coordinators of this club can add members
    const isStaff = club.staffCoordinators.some(c => c.toString() === req.user._id.toString());
    if (!isStaff && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to manage members of this club" });
    }

    const user = await User.findOne({ registerNumber });
    if (!user) return res.status(404).json({ message: "Student not found" });

    if (club.members.includes(user._id)) {
      return res.status(400).json({ message: "Student is already a member of this club" });
    }

    club.members.push(user._id);
    await club.save();

    res.json({ message: "Student added to club successfully", club });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getClubMembers = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id).populate("members", "name registerNumber email department year");
    if (!club) return res.status(404).json({ message: "Club not found" });
    res.json(club.members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const joinClub = async (req, res) => {
  try {
    const { year, transactionId } = req.body;
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    if (req.user.role !== 'student') {
      return res.status(403).json({ message: "Only students can join clubs." });
    }

    if (club.members.includes(req.user._id) || club.studentCoordinators.includes(req.user._id)) {
      return res.status(400).json({ message: "You are already a member/coordinator of this club." });
    }

    const existingRequest = club.joinRequests.find(r => r.studentId.toString() === req.user._id.toString());
    if (existingRequest) {
      return res.status(400).json({ message: `You have a pending request with status: ${existingRequest.status}` });
    }

    // Direct Join for Open + Free clubs
    if (club.membershipType === 'open' && !club.isPaidMembership) {
        if (club.memberLimit > 0 && club.members.length >= club.memberLimit) {
            return res.status(400).json({ message: "Club has reached its maximum member capacity." });
        }
        club.members.push(req.user._id);
        await club.save();
        return res.json({ message: "Successfully joined the club!", club });
    }

    // Request-based Join for Controlled or Paid clubs
    if (club.isPaidMembership && !transactionId) {
        return res.status(400).json({ message: "Transaction ID is required for paid memberships." });
    }

    club.joinRequests.push({
        studentId: req.user._id,
        transactionId: transactionId || "N/A",
        status: "pending",
        appliedAt: Date.now()
    });

    await club.save();

    // Send confirmation email
    await sendEmail({
        email: req.user.email,
        subject: `Application Received: ${club.clubName}`,
        message: `Hello ${req.user.name},\n\nWe have received your application to join the "${club.clubName}" club.\n\nOur staff coordinators will review your request soon. If this is a paid membership, please ensure your Transaction ID (${transactionId || "N/A"}) is correct to avoid delays.\n\nBest Regards,\nNEC Club Management Team`
    });

    res.json({ message: "Join request submitted. Please wait for Staff approval.", club });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getJoinRequests = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id).populate("joinRequests.studentId", "name email registerNumber department year");
    if (!club) return res.status(404).json({ message: "Club not found" });

    // Auth check: only staff of this club or admin
    const isStaff = club.staffCoordinators.some(c => c.toString() === req.user._id.toString());
    if (!isStaff && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(club.joinRequests || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const manageJoinRequest = async (req, res) => {
  try {
    const { userId, action } = req.body; // action: 'approve' or 'reject'
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const isStaff = club.staffCoordinators.some(c => c.toString() === req.user._id.toString());
    if (!isStaff && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const requestIndex = club.joinRequests.findIndex(r => r.studentId.toString() === userId);
    if (requestIndex === -1) return res.status(404).json({ message: "Request not found" });

    if (action === 'approve') {
        const studentId = club.joinRequests[requestIndex].studentId;
        if (!club.members.includes(studentId)) {
            club.members.push(studentId);
        }
        club.joinRequests.splice(requestIndex, 1); // Remove after approval
        
        // Handle deferred password setup for new students
        const student = await User.findById(studentId);
        if (student) {
            const sendEmail = require("../utils/emailSender");
            if (!student.isSetup) {
                const crypto = require("crypto");
                const inviteToken = crypto.randomBytes(20).toString("hex");
                student.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
                student.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
                await student.save();

                const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
                const setupUrl = `${frontendUrl}/setup-password.html?token=${inviteToken}`;

                await sendEmail({
                    email: student.email,
                    subject: `Welcome to ${club.clubName} - Complete Verification`,
                    message: `Hello ${student.name},\n\nYour payment and application for "${club.clubName}" have been approved!\n\nSince this is your first time using our portal, you must set an account password. Click the link below to verify your account:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
                });
            } else {
                await sendEmail({
                    email: student.email,
                    subject: `Application Approved: ${club.clubName}`,
                    message: `Hello ${student.name},\n\nYour application to join "${club.clubName}" has been approved! You can now log into your student dashboard to see our events and participate.`
                });
            }
        }
    } else {
        club.joinRequests[requestIndex].status = "rejected";
        // Or remove it:
        club.joinRequests.splice(requestIndex, 1);
    }

    await club.save();
    res.json({ message: `Student request ${action}ed successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeMemberFromClub = async (req, res) => {
  try {
    const { userId } = req.params;
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    // Authorization: only staff coordinators of this club or admin
    const isStaff = club.staffCoordinators.some(c => c.toString() === req.user._id.toString());
    if (!isStaff && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to manage members of this club" });
    }

    // Check member exists in club
    const memberIndex = club.members.findIndex(m => m.toString() === userId);
    if (memberIndex === -1) {
      return res.status(404).json({ message: "Student is not a member of this club" });
    }

    club.members.splice(memberIndex, 1);
    await club.save();

    res.json({ message: "Student removed from club successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addStudentCoordinator = async (req, res) => {
  try {
    const { email } = req.body;
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    // Authorization: only staff coordinators of this club can add student coordinators
    const isStaff = club.staffCoordinators.some(c => c.toString() === req.user._id.toString());
    if (!isStaff && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to add student coordinators to this club" });
    }

    let user = await User.findOne({ email });
    const crypto = require("crypto");
    const sendEmail = require("../utils/emailSender");

    if (!user) {
      // Create pending student user
      user = await User.create({
        name: "Pending Student",
        email,
        password: crypto.randomBytes(8).toString("hex"),
        role: "student",
      });
    } else if (user.role !== "student") {
      return res.status(400).json({ message: "User is not a student" });
    }

    if (club.studentCoordinators.includes(user._id)) {
      return res.status(400).json({ message: "Student is already a coordinator of this club" });
    }

    if (!user.isSetup) {
      const inviteToken = crypto.randomBytes(20).toString("hex");
      user.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
      user.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
      user.clubId = club._id;
      user.clubName = club.clubName;
      await user.save();

      const setupUrl = `${process.env.FRONTEND_URL}/accept-invite.html?token=${inviteToken}`;
      await sendEmail({
        email: user.email,
        subject: `Student Coordinator Assignment: ${club.clubName}`,
        message: `Hello, you have been assigned as a Student Coordinator for ${club.clubName}.\n\nPlease complete your registration and set your password using the link below:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
      });
    } else {
      user.clubId = club._id;
      user.clubName = club.clubName;
      await user.save();

      await sendEmail({
        email: user.email,
        subject: `You are also part of: ${club.clubName}`,
        message: `Hello ${user.name},\n\nThis is to inform you that you have also been added to "${club.clubName}" as a Student Coordinator.\n\nPlease log in to your dashboard to get started.`
      });
    }

    club.studentCoordinators.push(user._id);
    await club.save();

    res.json({ message: "Student coordinator invited/added successfully", club });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addStaffCoordinator = async (req, res) => {
  try {
    const { email } = req.body;
    const { id } = req.params;

    // 1. Find the organization (Club or Association)
    let org = await Club.findById(id);
    let isAssociation = false;
    
    if (!org) {
      org = await Association.findById(id);
      isAssociation = true;
    }

    if (!org) return res.status(404).json({ message: "Organization not found" });

    // 2. Authorization: only existing staff coordinators or admin
    const isStaff = org.staffCoordinators.some(c => c.toString() === req.user._id.toString());
    if (!isStaff && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to add staff coordinators to this organization" });
    }

    // 3. Process the user
    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        name: "Pending Staff",
        email: email.toLowerCase(),
        password: crypto.randomBytes(8).toString("hex"),
        role: "staff",
        department: "Engineering" // Default
      });
    } else {
      // Elevate role if necessary
      if (user.role === 'student') {
        user.role = 'staff';
        isNewUser = true; // Still treat as "new" to send invitation/setup link
      }
    }

    // 4. Check if already a coordinator
    if (org.staffCoordinators.includes(user._id)) {
      return res.status(400).json({ message: "User is already a staff coordinator of this organization" });
    }

    // 5. Add to organization
    org.staffCoordinators.push(user._id);
    await org.save();

    // 6. Update user's primary organization link
    if (isAssociation) {
      user.associationId = org._id;
    } else {
      user.clubId = org._id;
    }
    user.clubName = isAssociation ? org.name : org.clubName;
    
    // 7. Handle invitation for new/promoted users
    if (isNewUser) {
      const inviteToken = crypto.randomBytes(20).toString("hex");
      user.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
      user.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
      await user.save();

      const setupUrl = `${process.env.FRONTEND_URL}/accept-invite.html?token=${inviteToken}`;
      await sendEmail({
        email: user.email,
        subject: `Staff Coordinator Assignment: ${user.clubName}`,
        message: `Hello, you have been assigned as a Staff Coordinator for ${user.clubName}.\n\nPlease complete your profile and set your password using the link below:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
      });
    } else {
      await user.save();
      await sendEmail({
        email: user.email,
        subject: `You are also part of: ${user.clubName}`,
        message: `Hello ${user.name},\n\nThis is to inform you that you have also been added to "${user.clubName}" as a Staff Coordinator.\n\nPlease log in to your dashboard to get started.`
      });
    }

    res.json({ message: "Staff coordinator added successfully", org });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const setupJoinForm = async (req, res) => {
  try {
    const { membershipType, memberLimit, isPaidMembership, membershipFee } = req.body;
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    // Authorization: only staff coordinators of this club or admin
    const isStaff = club.staffCoordinators.some(c => c.toString() === req.user._id.toString());
    if (!isStaff && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized setup join form for this club" });
    }

    club.membershipType = membershipType || club.membershipType;
    club.memberLimit = memberLimit !== undefined ? memberLimit : club.memberLimit;
    club.isPaidMembership = isPaidMembership !== undefined ? isPaidMembership : club.isPaidMembership;
    club.membershipFee = membershipFee !== undefined ? membershipFee : club.membershipFee;
    club.hasJoinForm = true;

    await club.save();

    res.json({ message: "Join request form configured successfully", club });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeStaffCoordinator = async (req, res) => {
  try {
    const { staffId } = req.body;
    const { id } = req.params;

    // 1. Find the organization
    let org = await Club.findById(id);
    let isAssociation = false;
    
    if (!org) {
      org = await Association.findById(id);
      isAssociation = true;
    }

    if (!org) return res.status(404).json({ message: "Organization not found" });

    // 2. Authorization: Only Admin can remove staff for stability
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only administrators can remove staff coordinators" });
    }

    // 3. Prevent removing the last staff coordinator
    if (org.staffCoordinators.length <= 1) {
      return res.status(400).json({ message: "Cannot remove the last staff coordinator. Each organization must have at least one." });
    }

    // 4. Check if staff exists in organization
    const staffIndex = org.staffCoordinators.findIndex(s => s.toString() === staffId);
    if (staffIndex === -1) {
      return res.status(404).json({ message: "Staff coordinator not found in this organization" });
    }

    // 5. Remove from organization
    org.staffCoordinators.splice(staffIndex, 1);
    await org.save();

    res.json({ message: "Staff coordinator removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  getAllClubs, 
  getPublicClubs,
  joinClub, 
  getClubDetails, 
  addMemberToClub, 
  getClubMembers, 
  removeMemberFromClub, 
  addStudentCoordinator,
  addStaffCoordinator,
  removeStaffCoordinator,
  getJoinRequests,
  manageJoinRequest,
  getPublicDepartments,
  toggleRegistration,
  setupJoinForm
};
