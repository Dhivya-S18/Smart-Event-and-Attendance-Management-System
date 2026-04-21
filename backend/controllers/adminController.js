const mongoose = require("mongoose");
const User = require("../models/User");
const Club = require("../models/Club");
const Event = require("../models/Event");
const Department = require("../models/Department");
const Association = require("../models/Association");
const Certificate = require("../models/Certificate");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sendEmail = require("../utils/emailSender");

const getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClubs = await Club.countDocuments();
    const totalEvents = await Event.countDocuments();
    const completedEvents = await Event.countDocuments({ status: "completed" });
    const publishedEvents = await Event.countDocuments({ status: "published" });

    res.json({
      totalUsers,
      totalClubs,
      totalEvents,
      completedEvents,
      publishedEvents,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    const department = await Department.create({ name });
    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: "Department deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAssociations = async (req, res) => {
  try {
    const associations = await Association.find().populate("departmentId", "name");
    res.json(associations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createAssociation = async (req, res) => {
  try {
    const { name, departmentId, hodId, staffEmails = [] } = req.body;

    // 1. RULE: Each department must have ONE association
    const existingDeptAssociation = await Association.findOne({ departmentId });
    if (existingDeptAssociation) {
      return res.status(400).json({ message: "This department already has an association." });
    }

    // 2. RULE: Association names must be unique (case-insensitive)
    const existingNameAssociation = await Association.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    if (existingNameAssociation) {
      return res.status(400).json({ message: "An association with this name already exists." });
    }

    const dept = await Department.findById(departmentId);
    
    // Process HOD
    const hodUser = await User.findById(hodId);
    if (!hodUser) return res.status(404).json({ message: "Selected HOD not found." });

    if (!hodUser.isSetup) {
      const inviteTokenHOD = crypto.randomBytes(20).toString("hex");
      hodUser.invitationToken = crypto.createHash("sha256").update(inviteTokenHOD).digest("hex");
      hodUser.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
      await hodUser.save();

      const setupUrlHOD = `${process.env.FRONTEND_URL}/accept-invite.html?token=${inviteTokenHOD}`;
      await sendEmail({
        email: hodUser.email,
        subject: `Association Assignment: ${name}`,
        message: `Hello, you have been assigned as Head of ${name}. \n\nPlease setup your login credentials using the link below:\n\n${setupUrlHOD}\n\nThis link expires in 24 hours.`
      });
    } else {
      await sendEmail({
        email: hodUser.email,
        subject: `You are also part of: ${name}`,
        message: `Hello ${hodUser.name},\n\nThis is to inform you that you have also been added as Head of "${name}".\n\nPlease log in to your dashboard to get started.`
      });
    }

    // 3. Unified Identification & Invitation
    // Map of email -> metadata
    const usersToProcess = new Map();
    
    // Add Staff
    staffEmails.forEach(email => {
      const e = email.toLowerCase();
      if (!usersToProcess.has(e)) {
        usersToProcess.set(e, { role: 'staff', isHod: false });
      }
    });

    const userIds = { hod: hodUser._id, staff: [] };

    for (const [email, meta] of usersToProcess.entries()) {
      let user = await User.findOne({ email });
      
      if (!user) {
        user = await User.create({
          name: meta.isHod ? "Head of Department" : "Staff Coordinator",
          email,
          password: crypto.randomBytes(8).toString("hex"),
          role: meta.role,
          department: dept ? dept.name : "Engineering"
        });
      } else {
        // Ensure role is correct (elevation if necessary)
        if (meta.isHod) user.role = 'hod';
        else if (user.role === 'student') user.role = 'staff'; // Elevate student to staff if assigned as coord
        
        if (dept) user.department = dept.name;
        await user.save();
      }

      // Track IDs for Association creation
      if (meta.isHod) userIds.hod = user._id;
      else userIds.staff.push(user._id);

      if (!user.isSetup) {
        // Generate a fresh invitation token if not setup
        const inviteToken = crypto.randomBytes(20).toString("hex");
        user.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
        user.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        await user.save();

        const setupUrl = `${process.env.FRONTEND_URL}/accept-invite.html?token=${inviteToken}`;
        await sendEmail({
          email: user.email,
          subject: `Association Assignment: ${name}`,
          message: `Hello, you have been assigned to ${name} as a ${meta.role}.\n\nPlease setup your login credentials using the link below:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
        });
      } else {
        await sendEmail({
          email: user.email,
          subject: `You are also part of: ${name}`,
          message: `Hello ${user.name},\n\nThis is to inform you that you have also been added to "${name}" as a ${meta.role}.\n\nPlease log in to your dashboard to get started.`
        });
      }
    }

    const association = await Association.create({ 
      name, 
      departmentId, 
      hodId: userIds.hod, 
      staffCoordinators: userIds.staff 
    });

    const allUsersToUpdate = [userIds.hod, ...userIds.staff].filter(Boolean);
    if (allUsersToUpdate.length > 0) {
      await User.updateMany(
        { _id: { $in: allUsersToUpdate } },
        { $set: { associationId: association._id, clubName: association.name } }
      );
    }

    res.status(201).json({ message: "Association created and invites sent", association });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAssociationDetails = async (req, res) => {
  try {
    const association = await Association.findById(req.params.id)
      .populate("departmentId", "name")
      .populate("hodId", "name email profilePic")
      .populate("staffCoordinators", "name email profilePic")
      .populate("studentCoordinators", "name email registerNumber profilePic");

    if (!association) return res.status(404).json({ message: "Association not found" });

    // Fetch linked events
    const Event = require("../models/Event");
    const events = await Event.find({ associationId: req.params.id })
      .sort({ date: -1 });

    res.json({ association, events });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteAssociation = async (req, res) => {
  try {
    const association = await Association.findById(req.params.id);
    if (!association) return res.status(404).json({ message: "Association not found" });

    // Unlink users
    const userIdsToCleanup = [
      association.hodId, 
      ...(association.staffCoordinators || []), 
      ...(association.studentCoordinators || [])
    ].filter(Boolean);

    if (userIdsToCleanup.length > 0) {
      await User.updateMany(
        { _id: { $in: userIdsToCleanup } },
        { $set: { associationId: null, clubName: "" } }
      );
    }

    await Association.findByIdAndDelete(req.params.id);
    res.json({ message: "Association deleted and users unlinked" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().populate("clubId", "clubName").select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, email, role, department, year, registerNumber } = req.body;
    
    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    user.department = department || user.department;
    user.year = year || user.year;
    user.registerNumber = registerNumber || user.registerNumber;

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`[Admin] Initiating deletion for user: ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log(`[Admin] Invalid User ID format: ${userId}`);
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log(`[Admin] User not found: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    const objId = new mongoose.Types.ObjectId(userId);

    // 1. Cleanup references in Clubs
    console.log(`[Admin] Cleaning up Club references for user: ${userId}`);
    await Club.updateMany(
      {},
      { 
        $pull: { 
          hods: objId, 
          staffCoordinators: objId, 
          studentCoordinators: objId, 
          members: objId 
        } 
      }
    );

    // 2. Cleanup references in Associations
    console.log(`[Admin] Cleaning up Association references for user: ${userId}`);
    await Association.updateMany(
      {},
      { $pull: { staffCoordinators: objId, studentCoordinators: objId } }
    );
    // Unset hodId if it matches the user being deleted
    await Association.updateMany({ hodId: objId }, { $set: { hodId: null } });

    // 3. Cleanup references in Events
    console.log(`[Admin] Cleaning up Event references for user: ${userId}`);
    await Event.updateMany(
      { participants: objId },
      { $pull: { participants: objId } }
    );
    await Event.updateMany(
      { selectedStaff: objId },
      { $set: { selectedStaff: null } }
    );
    // Remove individual HOD approval entries if they exist
    await Event.updateMany(
      { "hodApprovals.hodId": objId },
      { $pull: { hodApprovals: { hodId: objId } } }
    );

    // 4. Cleanup certificates
    console.log(`[Admin] Cleaning up Certificate references for user: ${userId}`);
    await Certificate.updateMany(
      { studentId: objId },
      { $set: { studentId: null } }
    );

    console.log(`[Admin] Deleting User record: ${userId}`);
    await User.findByIdAndDelete(userId);
    
    console.log(`[Admin] Deletion successful for user: ${userId}`);
    res.json({ message: "User deleted successfully and unlinked from all organizations and events" });
  } catch (error) {
    console.error(`[Admin] ERROR during user deletion (${req.params.id}):`, error);
    res.status(500).json({ message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department, registerNumber } = req.body;
    
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password: password, // Mongoose pre-save hook handles hashing
      role: role || "student",
      department,
      registerNumber
    });

    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createClub = async (req, res) => {
  try {
    const { 
      clubName, 
      description, 
      clubType, 
      departmentIds, 
      hods: hodIdsFromFrontend = [],
      hodEmails = "", 
      staffEmails = "", 
      eventVisibility,
      membershipType,
      memberLimit
    } = req.body;

    const parseEmails = (str) => {
      if (Array.isArray(str)) return str.map(e => e.trim().toLowerCase()).filter(e => e);
      if (typeof str === 'string') return str.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
      return [];
    };
    const hodList = parseEmails(hodEmails);
    const staffList = parseEmails(staffEmails);

    // Validation
    if (clubType === "department") {
      if (!departmentIds || departmentIds.length !== 1) {
        return res.status(400).json({ message: "Department club must have exactly one department." });
      }
      const totalHods = hodList.length + hodIdsFromFrontend.length;
      if (totalHods !== 1) return res.status(400).json({ message: "Department club requires exactly one HOD." });
    } else if (clubType === "shared") {
      if (!departmentIds || departmentIds.length < 2) {
        return res.status(400).json({ message: "Shared club must have multiple departments." });
      }
      const totalHods = hodList.length + hodIdsFromFrontend.length;
      if (totalHods !== departmentIds.length) {
        return res.status(400).json({ message: `Shared club requires one HOD from EACH assigned department (${departmentIds.length} required).` });
      }
    } else if (clubType === "independent") {
      if (departmentIds && departmentIds.length > 0) {
        return res.status(400).json({ message: "Independent clubs cannot have departments." });
      }
      const totalHods = hodList.length + hodIdsFromFrontend.length;
      if (totalHods > 0) {
        return res.status(400).json({ message: "Independent clubs cannot have HODs." });
      }
    }

    const userIds = { hods: [...hodIdsFromFrontend], staff: [] };
    const usersToProcessEmails = new Map();
    
    hodList.forEach(email => usersToProcessEmails.set(email, { role: 'hod', isHod: true }));
    staffList.forEach(email => {
      if (!usersToProcessEmails.has(email)) usersToProcessEmails.set(email, { role: 'staff', isHod: false });
    });

    // Process users from email strings (new or existing via email)
    for (const [email, meta] of usersToProcessEmails.entries()) {
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: meta.isHod ? "Head of Department" : "Staff Coordinator",
          email,
          password: crypto.randomBytes(8).toString("hex"),
          role: meta.role,
        });
      } else {
        if (meta.isHod && user.role !== 'admin') user.role = 'hod';
        else if (user.role === 'student') user.role = 'staff';
        await user.save();
      }

      if (meta.isHod) userIds.hods.push(user._id);
      else userIds.staff.push(user._id);

      try {
        if (!user.isSetup) {
          const inviteToken = crypto.randomBytes(20).toString("hex");
          user.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
          user.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
          await user.save();
          const setupUrl = `${process.env.FRONTEND_URL}/accept-invite.html?token=${inviteToken}`;
          await sendEmail({
            email: user.email,
            subject: `Club Assignment: ${clubName}`,
            message: `Hello, you have been assigned to ${clubName} as a ${meta.role}.\n\nPlease setup your profile and login credentials using the link below:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
          });
        } else {
          await sendEmail({
            email: user.email,
            subject: `You are also part of: ${clubName}`,
            message: `Hello ${user.name},\n\nThis is to inform you that you have also been added to "${clubName}" as a ${meta.role}.\n\nPlease log in to your dashboard to get started.`
          });
        }
      } catch (emailErr) {
        console.warn(`⚠️ Email failed for ${user.email}: ${emailErr.message}`);
      }
    }

    // Send emails to HODs selected by ID from the dropdown
    for (const hodId of hodIdsFromFrontend) {
      const hodUser = await User.findById(hodId);
      if (!hodUser) continue;

      try {
        if (!hodUser.isSetup) {
          const inviteToken = crypto.randomBytes(20).toString("hex");
          hodUser.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
          hodUser.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
          await hodUser.save();
          const setupUrl = `${process.env.FRONTEND_URL}/accept-invite.html?token=${inviteToken}`;
          await sendEmail({
            email: hodUser.email,
            subject: `Club Assignment: ${clubName}`,
            message: `Hello, you have been assigned to ${clubName} as a Head of Department.\n\nPlease setup your profile and login credentials using the link below:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
          });
        } else {
          await sendEmail({
            email: hodUser.email,
            subject: `You are also part of: ${clubName}`,
            message: `Hello ${hodUser.name},\n\nThis is to inform you that you have also been added to "${clubName}" as Head of Department.\n\nPlease log in to your dashboard to get started.`
          });
        }
      } catch (emailErr) {
        console.warn(`⚠️ Email failed for ${hodUser.email}: ${emailErr.message}`);
      }
    }

    const finalVisibility = eventVisibility || "public";
    const { isPaidMembership, membershipFee } = req.body;

    const club = await Club.create({
      clubName,
      description,
      clubType,
      departmentIds: (clubType === "independent") ? [] : departmentIds,
      hods: userIds.hods,
      staffCoordinators: userIds.staff,
      studentCoordinators: [],
      members: [],
      eventVisibility: finalVisibility,
      membershipType: membershipType || "controlled",
      memberLimit: memberLimit || 0,
      isPaidMembership: isPaidMembership || false,
      membershipFee: membershipFee || 0
    });

    const allClubUsersToUpdate = [...userIds.hods, ...userIds.staff].filter(Boolean);
    if (allClubUsersToUpdate.length > 0) {
      await User.updateMany(
        { _id: { $in: allClubUsersToUpdate } },
        { $set: { clubId: club._id, clubName: club.clubName } }
      );
    }

    res.status(201).json({ message: "Club created and invites sent successfully", club });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




const updateClub = async (req, res) => {
  try {
    const { 
      clubName, 
      description, 
      clubType, 
      departmentIds, 
      hods, // This might be an array of IDs from the UI
      staffEmails = "", // Support multi-staff via emails string
      studentCoordinators,
      eventVisibility 
    } = req.body;

    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    // Validation based on requirements
    const finalType = clubType || club.clubType;
    const finalDepts = departmentIds || club.departmentIds;
    const finalHods = hods !== undefined ? hods : club.hods;

    if (finalType === "department") {
      if (!finalDepts || finalDepts.length !== 1) {
        return res.status(400).json({ message: "Department club must have exactly one department." });
      }
      if (!finalHods || finalHods.length !== 1) return res.status(400).json({ message: "Department club requires exactly one HOD." });
    } else if (finalType === "shared") {
      if (!finalDepts || finalDepts.length < 2) {
        return res.status(400).json({ message: "Shared club must have multiple departments." });
      }
      if (!finalHods || finalHods.length !== finalDepts.length) {
        return res.status(400).json({ message: `Shared club requires one HOD from each assigned department (${finalDepts.length} required).` });
      }
    } else if (finalType === "independent") {
      if (finalDepts && finalDepts.length > 0) {
        return res.status(400).json({ message: "Independent clubs cannot have departments." });
      }
      if (finalHods && finalHods.length > 0) {
        return res.status(400).json({ message: "Independent clubs cannot have HODs." });
      }
    }

    club.clubName = clubName || club.clubName;
    club.description = description || club.description;
    club.clubType = finalType;
    club.departmentIds = finalDepts;
    club.hods = finalHods;

    // Handle Staff Update
    if (staffEmails) {
      const parseEmails = (str) => typeof str === 'string' ? str.split(',').map(e => e.trim().toLowerCase()).filter(e => e) : (Array.isArray(str) ? str : []);
      const staffList = parseEmails(staffEmails);
      const userIds = [];

      for (const email of staffList) {
        let user = await User.findOne({ email });
        let isNew = false;
        if (!user) {
          isNew = true;
          user = await User.create({
            name: "Staff Coordinator",
            email,
            password: crypto.randomBytes(8).toString("hex"),
            role: "staff",
          });
        } else {
          if (user.role === 'student') {
            user.role = 'staff';
            isNew = true;
          }
          await user.save();
        }

        if (isNew) {
           const inviteToken = crypto.randomBytes(20).toString("hex");
           user.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
           user.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
           await user.save();

           const setupUrl = `${process.env.FRONTEND_URL}/accept-invite.html?token=${inviteToken}`;
           await sendEmail({
             email: user.email,
             subject: `Club Assignment: ${club.clubName}`,
             message: `Hello, you have been assigned to ${club.clubName} as a Staff Coordinator.\n\nPlease setup your credentials using the link below:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
           });
        } else {
           await sendEmail({
             email: user.email,
             subject: `You are also part of: ${club.clubName}`,
             message: `Hello ${user.name},\n\nThis is to inform you that you have also been added to "${club.clubName}" as a Staff Coordinator.\n\nPlease log in to your dashboard to get started.`
           });
        }
        
        // Ensure user is linked to club
        if (user.clubId?.toString() !== club._id.toString()) {
            user.clubId = club._id;
            user.clubName = club.clubName;
            await user.save();
        }

        userIds.push(user._id);
      }
      club.staffCoordinators = userIds;
    }

    club.studentCoordinators = studentCoordinators || club.studentCoordinators;
    club.eventVisibility = eventVisibility || club.eventVisibility;
    club.membershipType = req.body.membershipType || club.membershipType;
    club.memberLimit = req.body.memberLimit !== undefined ? req.body.memberLimit : club.memberLimit;

    const updatedClub = await club.save();
    res.json(updatedClub);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteClub = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    // Unlink users
    const userIdsToCleanup = [
      ...(club.hods || []),
      ...(club.staffCoordinators || []),
      ...(club.studentCoordinators || []),
      ...(club.members || [])
    ].filter(Boolean);

    if (userIdsToCleanup.length > 0) {
      await User.updateMany(
        { _id: { $in: userIdsToCleanup } },
        { $set: { clubId: null, clubName: "" } }
      );
    }

    await Club.findByIdAndDelete(req.params.id);
    res.json({ message: "Club deleted successfully and users unlinked" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAdminClubs = async (req, res) => {
  try {
    const clubs = await Club.find()
      .populate("departmentIds", "name")
      .populate("hods", "name email department")
      .populate("staffCoordinators", "name email department")
      .populate("studentCoordinators", "name email department registerNumber")
      .populate("members", "name email department registerNumber");
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("clubId", "clubName")
      .populate("associationId", "name")
      .populate("createdBy", "name email");
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resendInvitation = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!['hod', 'staff'].includes(user.role)) {
      return res.status(400).json({ message: "Invitations can only be resent to HOD or Staff users" });
    }

    // Generate a fresh invitation token
    const inviteToken = crypto.randomBytes(20).toString("hex");
    user.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
    user.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    const setupUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${inviteToken}`;
    await sendEmail({
      email: user.email,
      subject: "Your Login Setup Link (Resent)",
      message: `Hello, here is your updated login setup link:\n\n${setupUrl}\n\nThis link expires in 24 hours.`
    });

    res.json({ message: `Invitation resent to ${user.email}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const backfillClubNames = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } });
    let updatedCount = 0;

    for (const user of users) {
      let entityName = null;

      // Check Clubs
      const club = await Club.findOne({
        $or: [
          { members: user._id },
          { studentCoordinators: user._id },
          { staffCoordinators: user._id },
          { hods: user._id }
        ]
      });

      if (club) {
        entityName = club.clubName;
        user.clubId = club._id;
      }

      // Check Associations
      if (!entityName) {
        const association = await Association.findOne({
          $or: [
            { studentCoordinators: user._id },
            { staffCoordinators: user._id },
            { hodId: user._id }
          ]
        });

        if (association) {
          entityName = association.name;
          user.associationId = association._id;
        }
      }

      if (entityName && user.clubName !== entityName) {
        user.clubName = entityName;
        await user.save();
        updatedCount++;
      }
    }
    
    res.json({ message: `Successfully backfilled ${updatedCount} users with their respective club/association names!` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
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
};
