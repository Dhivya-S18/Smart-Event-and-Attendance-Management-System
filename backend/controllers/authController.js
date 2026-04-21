const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Club = require("../models/Club");
const Association = require("../models/Association");

const generateToken = (user, club) => {
  return jwt.sign(
    { 
      id: user._id, 
      role: user.role, 
      department: user.department, 
      clubId: club ? club._id : null,
      clubName: club ? (club.clubName || club.name) : null
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: "30d" }
  );
};

const loginUser = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (role && user.role !== role) {
        return res.status(401).json({ message: "Invalid role selected for this account" });
      }

      // Build ALL organizations this user belongs to
      const organizations = [];

      if (user.role === 'staff') {
        const clubs = await Club.find({ staffCoordinators: user._id }).select("_id clubName");
        const assocs = await Association.find({ staffCoordinators: user._id }).select("_id name");
        clubs.forEach(c => organizations.push({ id: c._id, name: c.clubName, type: 'club', role: 'staff' }));
        assocs.forEach(a => organizations.push({ id: a._id, name: a.name, type: 'association', role: 'staff' }));

      } else if (user.role === 'hod') {
        const clubs = await Club.find({ hods: user._id }).select("_id clubName");
        const assocs = await Association.find({ hodId: user._id }).select("_id name");
        clubs.forEach(c => organizations.push({ id: c._id, name: c.clubName, type: 'club', role: 'hod' }));
        assocs.forEach(a => organizations.push({ id: a._id, name: a.name, type: 'association', role: 'hod' }));

      } else if (user.role === 'student') {
        const clubs = await Club.find({ $or: [{ members: user._id }, { studentCoordinators: user._id }] }).select("_id clubName studentCoordinators");
        const assocs = await Association.find({ studentCoordinators: user._id }).select("_id name");
        clubs.forEach(c => {
          const isCoord = c.studentCoordinators.some(sc => sc.toString() === user._id.toString());
          organizations.push({ id: c._id, name: c.clubName, type: 'club', role: isCoord ? 'student_coordinator' : 'member' });
        });
        assocs.forEach(a => organizations.push({ id: a._id, name: a.name, type: 'association', role: 'student_coordinator' }));
      }

      // Primary org for backward compat (first found)
      const primaryOrg = organizations[0] || null;
      const token = generateToken(user, primaryOrg ? { _id: primaryOrg.id, clubName: primaryOrg.name, name: primaryOrg.name } : null);

      res.json({
        token,
        role: user.role,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          registerNumber: user.registerNumber || null,
          clubId: primaryOrg ? primaryOrg.id : null,
          clubName: primaryOrg ? primaryOrg.name : null,
        },
        organizations, // ← ALL orgs for multi-org switcher
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set expire (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // In a real app, send email here. For now, return the token in the response for testing.
    res.json({
      message: "Reset token generated successfully",
      resetToken: resetToken, // SENDING DIRECTLY FOR SIMULATION
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    // Hash the incoming token to match what's stored in DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Check both: forgot-password token AND admin invitation token
    const user = await User.findOne({
      $or: [
        { resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: Date.now() } },
        { invitationToken: hashedToken, invitationTokenExpire: { $gt: Date.now() } }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Set new password
    user.password = password;

    // Clear whichever token was used
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.invitationToken = undefined;
    user.invitationTokenExpire = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password").populate("clubId").populate("associationId");
    const userObj = user.toObject();
    
    if (user.clubId) {
      userObj.clubName = user.clubId.clubName;
      userObj.clubId = user.clubId._id;
    } else if (user.associationId) {
      userObj.clubName = user.associationId.name;
      userObj.associationId = user.associationId._id;
    }

    res.json(userObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCoordinators = async (req, res) => {
  try {
    let entity = await Club.findOne({ 
      $or: [{ members: req.user._id }, { studentCoordinators: req.user._id }, { staffCoordinators: req.user._id }] 
    });
    
    if (!entity) {
      entity = await Association.findOne({
        $or: [{ studentCoordinators: req.user._id }, { staffCoordinators: req.user._id }]
      });
    }
    
    if (!entity) {
      return res.json([]);
    }

    const coordinators = await User.find({ 
      _id: { $in: entity.staffCoordinators } 
    }).select("name department");
    
    res.json(coordinators);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const acceptInvite = async (req, res) => {
  const { token, password, name, phone } = req.body;

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      invitationToken: hashedToken, 
      invitationTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired invitation token" });
    }

    user.password = password;
    if (name) user.name = name;
    if (phone) user.phone = phone;

    // Auto-extract register number from email for students if missing
    if (user.role === 'student' && user.email && !user.registerNumber) {
      const emailParts = user.email.split('@');
      if (emailParts.length === 2 && emailParts[1].includes('nec.edu.in')) {
        user.registerNumber = emailParts[0];
      }
    }

    user.invitationToken = undefined;
    user.invitationTokenExpire = undefined;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.isSetup = true;



    await user.save();

    res.json({ message: "Account created successfully. You can now login." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const requestClubJoin = async (req, res) => {
    const { name, email, registerNumber, department, year, clubId } = req.body;
    const sendEmail = require("../utils/emailSender");

    console.log(`Join request received for ${email} to club ${clubId}`);

    console.log("Full Join Request Payload:", req.body);

    try {
        if (!email) return res.status(400).json({ message: "Registration Error: Email is missing." });
        if (!clubId) return res.status(400).json({ message: "Registration Error: Club ID is missing." });

        let user = await User.findOne({ email });
        const club = await Club.findById(clubId);

        if (!club) {
            console.error("Club Lookup Failed for ID:", clubId);
            return res.status(404).json({ message: "Club not found in database." });
        }

        if (!user) {
            console.log("Flow: Creating new student record for:", email);
            user = new User({
                name: name || "Pending Student",
                email,
                registerNumber,
                department,
                year: year ? parseInt(year) : undefined,
                role: 'student',
                password: crypto.randomBytes(16).toString('hex'), 
                isSetup: false
            });
            await user.save();
        }

        // Enrollment Constraint Checklist
        if (club.allowedDepartments && club.allowedDepartments.length > 0) {
            const userDept = user.department;
            const isAllowedDept = club.allowedDepartments.some(d => d.toLowerCase() === userDept.toLowerCase());
            if (!isAllowedDept) {
                return res.status(403).json({ message: `Access Denied: This club is restricted to specific departments. You belong to ${userDept}.` });
            }
        }

        if (club.allowedYears && club.allowedYears.length > 0) {
            const userYear = parseInt(user.year);
            if (!club.allowedYears.includes(userYear)) {
                const allowedStr = club.allowedYears.join(", ");
                return res.status(403).json({ message: `Access Denied: This club is restricted to students in years: ${allowedStr}. You are in year ${userYear}.` });
            }
        }

        if (club.members && club.members.some(m => m.toString() === user._id.toString())) {
            return res.status(400).json({ message: "Wait! You are already a confirmed member of this club." });
        }
        if (club.studentCoordinators && club.studentCoordinators.some(c => c.toString() === user._id.toString())) {
            return res.status(400).json({ message: "Wait! You are already a coordinator for this club." });
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        
        // Helper to generate and email setup link
        async function sendSetupEmail(subjectSuffix, customMessage) {
            const inviteToken = crypto.randomBytes(20).toString("hex");
            user.invitationToken = crypto.createHash("sha256").update(inviteToken).digest("hex");
            user.invitationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;
            await user.save();

            const setupUrl = `${frontendUrl}/setup-password.html?token=${inviteToken}`;
            await sendEmail({
                email: user.email,
                subject: `Welcome to ${club.clubName} - ${subjectSuffix}`,
                message: `Hello ${user.name},\n\n${customMessage}\n\nTo complete your registration and set your account password, click the link below:\n\n${setupUrl}\n\nThis link expires in 24 hours.\n\nBest Regards,\nNEC Club Management Team`
            });
        }

        // 1. Open + Free Clubs (Instant Join)
        if (club.membershipType === 'open' && !club.isPaidMembership) {
            console.log("Flow: Instant Join (Open + Free)");
            if (club.memberLimit > 0 && club.members.length >= club.memberLimit) {
                return res.status(400).json({ message: "Sorry, this club has reached its maximum capacity." });
            }
            
            if (!club.members.some(m => m.toString() === user._id.toString())) {
                club.members.push(user._id);
                await club.save();
            }

            if (!user.isSetup) {
                await sendSetupEmail("Complete Verification", `You have successfully joined "${club.clubName}".`);
                return res.json({ message: "Success! You joined the club. Check your email to set your dashboard password." });
            } else {
                await sendEmail({
                    email: user.email,
                    subject: `Welcome to ${club.clubName}`,
                    message: `Hello ${user.name},\n\nYou have successfully joined "${club.clubName}". Visit your dashboard for updates.`
                });
                return res.json({ message: "Success! You have officially joined the club." });
            }
        }

        // 2. Controlled or Paid Clubs (Requires Queueing)
        const pendingCheck = (club.joinRequests || []).find(r => r.studentId && r.studentId.toString() === user._id.toString());
        if (!pendingCheck) {
            console.log("Flow: Adding to Join Requests queue");
            club.joinRequests.push({
                studentId: user._id,
                transactionId: "N/A",
                status: "pending",
                appliedAt: Date.now()
            });
            await club.save();
        } else {
            console.log("Flow: User already in queue");
            return res.status(400).json({ message: "You already have a pending application. Please wait for the staff to review it." });
        }

        // 3. Paid Memberships
        if (club.isPaidMembership) {
            console.log("Flow: Paid Membership Email Dispatch (Payment Request)");
            await sendEmail({
                email: user.email,
                subject: `Complete your Join Request: ${club.clubName}`,
                message: `Hello ${user.name},\n\nYour application for "${club.clubName}" is pending a membership fee of ₹${club.membershipFee}.\n\nTo complete your application, please coordinate with your club staff for payment. Once they confirm receipt, they will approve your request, and you will receive a bridge link to set your dashboard password.\n\nBest Regards,\nNEC Club Management Team`
            });
            return res.json({ message: "Application submitted! Check your email for payment instructions." });
        }

        // 4. Controlled but Free
        if (!user.isSetup) {
            console.log("Flow: Free Club + New User (Instant Invitation)");
            await sendSetupEmail("Finalize Registration", `Your membership request for "${club.clubName}" has been received.\n\nSince this is a free club, you can proceed with setting up your account immediately. Click the link below to verify your email and set your password:\n\n[This will allow you to track your application status]`);
            return res.json({ message: "Application submitted! Check your email to set your password." });
        } else {
            console.log("Flow: Free Club (Receipt)");
            await sendEmail({
                email: user.email,
                subject: `Application Received: ${club.clubName}`,
                message: `Hello ${user.name},\n\nYour application for "${club.clubName}" has been received and is under review by the club staff.`
            });
            return res.json({ message: "Application submitted! You can track the status in your dashboard." });
        }
    } catch (error) {
        console.error("CRITICAL JOIN ERROR:", error.stack || error);
        res.status(500).json({ message: "System Error: " + (error.message || "Unknown error occurred.") });
    }
};

module.exports = { loginUser, getMe, forgotPassword, resetPassword, getCoordinators, acceptInvite, requestClubJoin };
