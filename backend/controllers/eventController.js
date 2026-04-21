const Event = require("../models/Event");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Club = require("../models/Club");
const Association = require("../models/Association");
const Department = require("../models/Department");
const Registration = require("../models/Registration");
const { generateCircularFile, generateCertificateFile } = require("../utils/generator");
const { generatePoster } = require("../utils/imageGenerator");
const sendEmail = require("../utils/emailSender");
const xlsx = require("xlsx");

const normalizeDepartment = (name) => {
  if (!name) return "";
  const n = name.toLowerCase().trim();
  if (n.includes("computer science") || n === "cse") return "computer science and engineering";
  if (n.includes("information technology") || n === "it") return "information technology";
  if (n.includes("electronics") || n === "ece") return "electronics and communication engineering";
  if (n.includes("electrical") || n === "eee") return "electrical and electronics engineering";
  if (n.includes("mechanical") || n === "mech") return "mechanical engineering";
  if (n.includes("civil")) return "civil engineering";
  if (n.includes("artificial intelligence") || n === "aids" || n.includes("ai&ds")) return "artificial intelligence and data science";
  return n;
};

const checkClubMembership = async (user, event) => {
  if (user.role === "admin") return true;
  
  const userClubId = user.clubId ? user.clubId.toString() : null;
  const userAssocId = user.associationId ? user.associationId.toString() : null;
  
  const eventClubId = event.clubId ? (event.clubId._id || event.clubId).toString() : null;
  const eventAssocId = event.associationId ? (event.associationId._id || event.associationId).toString() : null;
  
  if (userClubId && userClubId === eventClubId) return true;
  if (userAssocId && userAssocId === eventAssocId) return true;
  
  return false;
};

const notifyApprovers = async (event, recipientRole) => {
  try {
    let query = { role: recipientRole };
    if (recipientRole === "staff") {
      if (event.clubId) query.clubId = event.clubId;
      if (event.associationId) query.associationId = event.associationId;
    } else if (recipientRole === "hod") {
      // For HODs, we rely on the hodApprovals array initialized in the event
      if (event.hodApprovals && event.hodApprovals.length > 0) {
        query._id = { $in: event.hodApprovals.map(a => a.hodId) };
      } else {
        query.department = event.department;
      }
    }

    const recipients = await User.find(query);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const dashboardLink = `${frontendUrl}/dashboards/${recipientRole}.html`;

    for (const recipient of recipients) {
      // Create/Update Internal Notification
      await Notification.findOneAndUpdate(
        { 
          recipient: recipient._id, 
          relatedId: event._id, 
          type: "event_approval" 
        },
        { 
          message: `Action Required: Event approval request - ${event.title}`,
          read: false,
          sender: event.createdBy,
          onModel: "Event"
        },
        { upsert: true, new: true }
      );

      // Send Email Notification
      await sendEmail({
        email: recipient.email,
        subject: `Action Required: Event Approval Request - ${event.title}`,
        message: `Hello ${recipient.name},\n\nA new event approval request has been submitted for "${event.title}".\n\nPlease review and take action at: ${dashboardLink}\n\nEvent Details:\n- Title: ${event.title}\n- Date: ${new Date(event.date).toLocaleDateString()}\n- Venue: ${event.venue}\n\nBest Regards,\nClub Event Management Team`,
      });
    }
  } catch (error) {
    console.error("Failed to notify approvers:", error);
  }
};


const createEvent = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("clubId").populate("associationId");
    if (user.role !== "student" && user.role !== "staff" && user.role !== "coordinator") {
      return res.status(403).json({ message: "You do not have permission to create an event." });
    }
    
    if (!user.clubId && !user.associationId) {
      return res.status(400).json({ message: "User is not associated with a club or association." });
    }

    const club = user.clubId;
    const association = user.associationId;
    let initialStatus = "pending_staff_approval";

    // Use organization from user
    const clubId = club ? club._id : undefined;
    const associationId = association ? association._id : undefined;

    // RULE: Prevent duplicate event titles for the same host
    const query = { title: { $regex: new RegExp(`^${req.body.title}$`, 'i') } };
    if (associationId) query.associationId = associationId;
    else query.clubId = clubId;

    const existingEvent = await Event.findOne(query);
    if (existingEvent) {
      return res.status(400).json({ message: "An event with this title already exists for your club/association." });
    }

    const event = await Event.create({
      ...req.body,
      createdBy: req.user._id,
      clubId,
      associationId,
      department: associationId ? "Department" : ((club && club.departmentIds && club.departmentIds.length > 0) ? "Multiple" : "Independent"),
      status: initialStatus,
    });

    // Notify Staff
    await notifyApprovers(event, "staff");

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPublishedEvents = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await Event.find({ 
      status: "published",
      $or: [
        { date: { $gte: today } },            // upcoming events
        { feedbackEnabled: true }             // events with active feedback
      ]
    }).populate("clubId", "clubName department").populate("associationId", "name department");

    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyEvents = async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.user._id }).populate("clubId").populate("associationId");
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const staffApprove = async (req, res) => {
  try {
    const { action, staffFeedback, feedback, hodFeedback } = req.body;
    const finalFeedback = feedback || staffFeedback || hodFeedback || "";
    const event = await Event.findById(req.params.id).populate("clubId").populate("associationId");
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (action === "reject") {
      event.status = "rejected";
      event.staffApproved = false;
      event.staffFeedback = finalFeedback;
    } else if (action === "approve") {
      event.staffApproved = true;
      event.staffFeedback = finalFeedback;

      const club = event.clubId;
      const association = event.associationId;

      if (club) {
        // All club types (Independent, Shared, Department) now go to asset preparation first
        event.status = "circular_creation_pending";
      } else if (association) {
        // Associations always go to Circular -> HOD
        event.status = "circular_creation_pending";
      } else {
        // Fallback for independent users without club/assoc
        event.status = "published";
        event.published = true;
        event.publishedAt = Date.now();
      }
    }
    
    await event.save();
    res.json({ message: `Event ${action}ed by Staff`, event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const hodApprove = async (req, res) => {
  try {
    const { action, feedback, hodFeedback, staffFeedback } = req.body;
    const finalFeedback = feedback || hodFeedback || staffFeedback || "";
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Find the current HOD's approval entry
    const approvalEntry = event.hodApprovals.find(a => a.hodId.toString() === req.user._id.toString());
    
    if (!approvalEntry) {
      return res.status(403).json({ message: "You are not an authorized HOD for this event." });
    }

    if (action === "reject") {
      event.status = "rejected";
      event.hodApproved = false;
      approvalEntry.status = "rejected";
      approvalEntry.feedback = finalFeedback || "HOD requested changes.";
      event.hodFeedback = `Rejected by ${req.user.name}: ${approvalEntry.feedback}`;
    } else if (action === "approve") {
      approvalEntry.status = "approved";
      approvalEntry.feedback = finalFeedback;
      approvalEntry.updatedAt = Date.now();

      // Check if all HODs have approved
      const allApproved = event.hodApprovals.every(a => a.status === "approved");
      
      if (allApproved) {
        event.status = "published";
        event.hodApproved = true;
        event.published = true;
        event.publishedAt = Date.now();
        event.hodFeedback = "Approved by all HODs.";
      } else {
        // Still pending other HODs
        event.hodFeedback = `Approved by ${req.user.name}. Waiting for others.`;
      }
    }
    
    await event.save();
    res.json({ message: `Approval recorded. Current event status: ${event.status}`, event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const submitToHod = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("clubId").populate("associationId");
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!event.circularPdf || !event.posterImage || !event.registrationLink) {
      return res.status(400).json({ message: "Circular, Poster, and Registration Link must be ready before sending to HOD." });
    }

    const club = event.clubId;
    const association = event.associationId;

    if (club) {
      if (club.clubType === "independent" || !club.hods || club.hods.length === 0) {
        // Independent Clubs or Shared/Dept without HOD: Publish immediately after assets are ready
        event.status = "published";
        event.published = true;
        event.publishedAt = Date.now();
        event.hodApproved = true; // Auto-marked as approved for workflow consistency
        event.hodFeedback = "Independent Club - Auto-published after asset preparation.";
      } else {
        // Shared or Department Clubs with HOD: Initialize approvals
        event.hodApprovals = club.hods.map(hodId => ({
          hodId,
          status: "pending"
        }));
        event.status = "pending_hod_approval";
      }
    } else if (association) {
      if (!association.hodId) {
        // Fallback for auto-publishing if no HOD assigned (shouldn't happen)
        event.status = "published";
        event.published = true;
        event.publishedAt = Date.now();
      } else {
        // Process association HOD approval
        event.hodApprovals = [{
          hodId: association.hodId,
          status: "pending"
        }];
        event.status = "pending_hod_approval";
      }
    } else {
       // Fallback for independent users
       event.status = "published";
       event.published = true;
       event.publishedAt = Date.now();
    }

    await event.save();

    // Notify all assigned HODs
    if (event.status === "pending_hod_approval") {
      await notifyApprovers(event, "hod");
    }

    res.json({ message: "Event submitted to HOD(s)", event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to update this event." });
    }

    // Capture original status
    const originalStatus = event.status;

    // Update fields
    Object.assign(event, req.body);

    // Extension Logic: If limits increased beyond current counts, registration could be reopened
    if (event.isTeamEvent) {
      if (event.maxTeams > event.registeredTeamsCount && !event.registrationEnabled) {
        event.registrationEnabled = true;
      }
    } else {
      if (event.maxParticipants > event.registeredCount && !event.registrationEnabled) {
        event.registrationEnabled = true;
      }
    }

    // If it was rejected, route back to the correct approver
    if (originalStatus === "rejected") {
      if (event.staffApproved) {
        // HOD rejected → staff already approved, send back to HOD
        event.status = "pending_hod_approval";
        event.hodApproved = false;
        event.hodFeedback = "";
      } else {
        // Staff rejected → send back to staff
        event.status = "pending_staff_approval";
        event.staffApproved = false;
        event.hodApproved = false;
        event.staffFeedback = "";
        event.hodFeedback = "";
      }
    }

    await event.save();

    // Notify appropriate person if status changed to pending
    if (event.status === "pending_staff_approval") {
      await notifyApprovers(event, "staff");
    } else if (event.status === "pending_hod_approval") {
      await notifyApprovers(event, "hod");
    }

    res.json({ message: "Event updated successfully", event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEventsByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) query.status = status;

    // RBAC Context Filtering
    if (req.user.role === "staff") {
      const userClubs = await Club.find({ staffCoordinators: req.user._id });
      const userAssocs = await Association.find({ staffCoordinators: req.user._id });
      
      query.$or = [
        { clubId: { $in: userClubs.map(c => c._id) } },
        { associationId: { $in: userAssocs.map(a => a._id) } }
      ];
    } else if (req.user.role === "hod") {
      const userClubs = await Club.find({ hods: req.user._id });
      const userAssocs = await Association.find({ hodId: req.user._id });
      
      query.$or = [
        { clubId: { $in: userClubs.map(c => c._id) } },
        { associationId: { $in: userAssocs.map(a => a._id) } },
        ...(req.user.department ? [{ department: req.user.department }] : [])
      ];
    } else if (req.user.role === "student") {
      const userClubs = await Club.find({
        $or: [
          { studentCoordinators: req.user._id },
          { members: req.user._id }
        ]
      });
      const userAssocs = await Association.find({ studentCoordinators: req.user._id });
      
      const clubIds = userClubs.map(c => c._id);
      const assocIds = userAssocs.map(a => a._id);

      query.$or = [
        { createdBy: req.user._id }, // Ensure creator can always see
        ...(clubIds.length > 0 ? [{ clubId: { $in: clubIds } }] : []),
        ...(assocIds.length > 0 ? [{ associationId: { $in: assocIds } }] : [])
      ];
    }
    // "admin" sees all natively.

    const events = await Event.find(query).populate("clubId").populate("associationId").populate("createdBy", "name");
    
    // Add registration counts
    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const registrationCount = await Registration.countDocuments({ event: event._id });
      return { ...event.toObject(), registrationCount };
    }));

    res.json(eventsWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.status !== "published" || !event.registrationEnabled) {
      return res.status(400).json({ message: "Registration is not open for this event." });
    }

    if (event.feedbackEnabled) {
      return res.status(400).json({ message: "Registration is closed as the event has moved to the feedback stage." });
    }

    const { studentName, registerNumber, department, year, email, phone, teamMembers } = req.body;
    
    // Validate primary student email
    const expectedEmail = `${registerNumber.toLowerCase()}@nec.edu.in`;
    if (email.toLowerCase() !== expectedEmail) {
      return res.status(400).json({ message: `Student email must be ${expectedEmail}` });
    }

    // Validate team members email
    if (teamMembers && Array.isArray(teamMembers)) {
      for (const member of teamMembers) {
        const expectedMemberEmail = `${member.registerNumber.toLowerCase()}@nec.edu.in`;
        if (member.email.toLowerCase() !== expectedMemberEmail) {
          return res.status(400).json({ message: `Team member ${member.name}'s email must be ${expectedMemberEmail}` });
        }
      }
    }

    // Visibility & Membership Check
    if (event.clubId) {
      const club = await Club.findById(event.clubId);
      if (club && club.eventVisibility === "members_only") {
        const memberUser = await User.findOne({ registerNumber });
        const isMember = memberUser && club.members.some(m => m.toString() === memberUser._id.toString());
        if (!isMember) {
          return res.status(403).json({ message: "This event is for club members only. You are not a member of this club." });
        }
      }
    }

    // Association Rules: Only students from that department can participate
    if (event.associationId) {
      const association = await Association.findById(event.associationId);
      if (association) {
        const studentUser = await User.findOne({ registerNumber });
        // Compare department with association's department
        // We use department names for flexibility or ID if available in studentUser
        if (studentUser && studentUser.department) {
           // Basic string match or ID check
           // If studentUser.department is a string, we might need to fetch the Dept object
           // But usually department in student is stored as a string name.
            const deptObj = await Department.findById(association.departmentId);
            if (deptObj && normalizeDepartment(studentUser.department) !== normalizeDepartment(deptObj.name)) {
              return res.status(403).json({ message: `This event is restricted to students of the ${deptObj.name} department.` });
            }
        }
      }
    }

    if (event.allowedYears && event.allowedYears.length > 0) {
      if (!year || !event.allowedYears.includes(parseInt(year))) {
        return res.status(400).json({ message: "You are not eligible for this event. It is restricted to specific year(s)." });
      }
    }

    if (event.allowedDepartments && event.allowedDepartments.length > 0) {
      if (!department) {
        return res.status(400).json({ message: "Department is required to ensure eligibility." });
      }
      const normalizedDept = normalizeDepartment(department);
      const isDeptAllowed = event.allowedDepartments.some(d => {
        return normalizedDept === normalizeDepartment(d);
      });
      if (!isDeptAllowed) {
        return res.status(400).json({ message: `You are not eligible for this event. Allowed departments: ${event.allowedDepartments.join(', ')}.` });
      }
    }

    // Limit Validation
    if (event.isTeamEvent) {
      if (event.maxTeams > 0 && event.registeredTeamsCount >= event.maxTeams) {
        return res.status(400).json({ message: "Registration Full: All team slots are filled." });
      }
    } else {
      if (event.maxParticipants > 0 && event.registeredCount >= event.maxParticipants) {
        return res.status(400).json({ message: "Registration Full: Maximum participants reached." });
      }
    }

    // Check if already registered by email
    const existingRegistration = await Registration.findOne({ event: event._id, email });
    if (existingRegistration) {
      return res.status(400).json({ message: "You are already registered for this event." });
    }

    const registration = await Registration.create({
      event: event._id,
      studentName,
      registerNumber,
      department,
      year,
      email,
      phone,
      teamMembers: (teamMembers || []).map(m => ({
        name: m.name,
        registerNumber: m.registerNumber,
        email: m.email
      })),
    });

    // Atomic Increment and Auto-Close Logic
    const incField = event.isTeamEvent ? "registeredTeamsCount" : "registeredCount";
    const updatedEvent = await Event.findByIdAndUpdate(
      event._id,
      { $inc: { [incField]: 1 } },
      { new: true }
    );

    // Check if we should auto-close
    if (updatedEvent.isTeamEvent) {
      if (updatedEvent.maxTeams > 0 && updatedEvent.registeredTeamsCount >= updatedEvent.maxTeams) {
        updatedEvent.registrationEnabled = false;
        await updatedEvent.save();
      }
    } else {
      if (updatedEvent.maxParticipants > 0 && updatedEvent.registeredCount >= updatedEvent.maxParticipants) {
        updatedEvent.registrationEnabled = false;
        await updatedEvent.save();
      }
    }

    // Actual Email Notification
    await sendEmail({
      email: email,
      subject: `Registration Confirmed - ${event.title}`,
      message: `Hello ${studentName},\n\nYou have successfully registered for ${event.title} at ${event.venue} on ${new Date(event.date).toLocaleDateString("en-GB")}.\n\nBest Regards,\nClub Management Team`
    });

    res.json({ message: "Successfully registered!", registration });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendReminders = async (req, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const upcomingEvents = await Event.find({
      status: "published"
    });

    let notificationsSent = 0;
    for (const event of upcomingEvents) {
      const eventDateStr = event.date.toISOString().split('T')[0];
      let type = null;
      let subject = "";
      let messageContent = "";

      if (eventDateStr === tomorrowStr) {
        type = "reminder_1_day";
        subject = `Reminder: ${event.title} is Tomorrow!`;
        messageContent = `Hello student, this is a reminder that ${event.title} is happening tomorrow at ${event.venue}. We look forward to seeing you there!`;
      } else if (eventDateStr === todayStr) {
        type = "reminder_today";
        subject = `Event Day: ${event.title} is Today!`;
        messageContent = `Hello student, ${event.title} is happening today at ${event.venue}. Don't miss it!`;
      }

      if (type) {
        const registrations = await Registration.find({ event: event._id });
        for (const reg of registrations) {
          await sendEmail({
            email: reg.email,
            subject: subject,
            message: messageContent.replace("student", reg.studentName)
          });

          await Notification.create({
            recipient: reg.email,
            message: subject,
            type: "reminder",
          });
          notificationsSent++;
        }
      }
    }

    res.json({ message: `Sent ${notificationsSent} reminders.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateCircularAPI = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("clubId");
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to prepare this event." });
    }

    Object.assign(event, req.body);
    if (req.body.associationName) event.associationName = req.body.associationName;
    if (req.body.eventType) event.eventType = req.body.eventType;
    
    const circularPath = await generateCircularFile(event);
    
    event.circularPdf = circularPath;
    await event.save();
    
    res.json({ message: "Circular generated", circularPdf: circularPath, event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generatePosterAPI = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("clubId");
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to prepare this event." });
    }

    const posterDetails = {
      title: req.body.title || event.title,
      date: req.body.date || event.date,
      venue: req.body.venue || event.venue,
      clubName: event.clubId ? event.clubId.clubName : "Club",
      tagline: req.body.tagline || "",
      organizerName: req.body.organizerName || "Coordinator",
      staffCoordinator2: req.body.staffCoordinator2 || "",
      studentCoordinator2: req.body.studentCoordinator2 || "",
      department: event.department || "",
      registrationLink: event.registrationLink || "http://localhost:5173/events" // Fallback link
    };

    if (req.body.staffCoordinator2) {
      event.staffCoordinator2 = req.body.staffCoordinator2;
    }
    if (req.body.studentCoordinator2) {
      event.studentCoordinator2 = req.body.studentCoordinator2;
    }

    const templateId = req.body.templateId || "1";
    const posterPath = await generatePoster(posterDetails, templateId);
    
    event.posterImage = posterPath;
    await event.save();
    
    res.json({ message: "Poster generated", posterImage: posterPath, event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createRegistrationForm = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to prepare this event." });
    }

    event.registrationEnabled = true;
    event.registrationLink = `/register.html?id=${event._id}`;
    await event.save();
    
    res.json({ message: "Registration form link generated", registrationLink: event.registrationLink, event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createFeedbackForm = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to prepare this event." });
    }

    event.feedbackEnabled = true;
    event.feedbackLink = `/event/feedback/${event._id}`;
    await event.save();

    res.json({ message: "Feedback form link generated", feedbackLink: event.feedbackLink, event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportAttendance = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const registrations = await Registration.find({ event: event._id });
    const flattenedData = [];

    registrations.forEach(reg => {
      // Add Leader
      flattenedData.push({
        Name: reg.studentName,
        Email: reg.email,
        RegisterNumber: reg.registerNumber || "N/A",
        Department: reg.department || "N/A",
        Phone: reg.phone || "N/A",
        Attended: reg.attended ? "Yes" : "No",
        FeedbackSubmitted: reg.feedbackSubmitted ? "Yes" : "No",
        Role: "Leader"
      });

      // Add Teammates
      if (reg.teamMembers && reg.teamMembers.length > 0) {
        reg.teamMembers.forEach(m => {
          flattenedData.push({
            Name: m.name,
            Email: m.email || "N/A",
            RegisterNumber: m.registerNumber || "N/A",
            Department: reg.department || "N/A", // Assume same dept for team if not specified
            Phone: "N/A",
            Attended: m.attended ? "Yes" : "No",
            FeedbackSubmitted: m.feedbackSubmitted ? "Yes" : "No",
            Role: "Teammate"
          });
        });
      }
    });

    const ws = xlsx.utils.json_to_sheet(flattenedData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Attendance");
    
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename="attendance_${event.title.replace(/\s+/g, '_')}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEventRegistrations = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to view registrations for this event." });
    }

    const registrations = await Registration.find({ event: event._id });
    const flattened = [];
    
    registrations.forEach(reg => {
      // Leader
      flattened.push({
        _id: reg._id,
        isTeammate: false,
        studentName: reg.studentName,
        registerNumber: reg.registerNumber,
        email: reg.email,
        department: reg.department,
        attended: reg.attended,
        feedbackSubmitted: reg.feedbackSubmitted,
        registeredAt: reg.registeredAt
      });
      
      // Teammates
      if (reg.teamMembers) {
        reg.teamMembers.forEach(m => {
          flattened.push({
            _id: `${reg._id}_${m.registerNumber}`,
            parentRegId: reg._id,
            isTeammate: true,
            studentName: m.name,
            registerNumber: m.registerNumber,
            email: m.email,
            department: reg.department,
            attended: m.attended,
            feedbackSubmitted: m.feedbackSubmitted,
            registeredAt: reg.registeredAt
          });
        });
      }
    });

    res.json(flattened);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const closeEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to close this event." });
    }

    event.status = "completed";
    event.feedbackEnabled = false;
    event.registrationEnabled = false;
    await event.save();

    res.json({ message: "Event marked as completed and feedback/registration closed.", event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleRegistration = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to toggle registration." });
    }

    event.registrationEnabled = !event.registrationEnabled;
    await event.save();

    res.json({ 
      message: `Registration ${event.registrationEnabled ? 'opened' : 'closed'} successfully`, 
      registrationEnabled: event.registrationEnabled,
      event 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("clubId");
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (!(await checkClubMembership(req.user, event))) {
      return res.status(403).json({ message: "You are not authorized to delete this event." });
    }

    // Remove associated registrations
    await Registration.deleteMany({ event: event._id });

    // Remove the event
    await Event.findByIdAndDelete(event._id);

    res.json({ message: "Event removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  createEvent, 
  getPublishedEvents, 
  getMyEvents,
  staffApprove, 
  hodApprove, 
  submitToHod,
  updateEvent,
  getEventsByStatus, 
  getEventRegistrations,
  registerForEvent,
  sendReminders,
  generateCircularAPI,
  generatePosterAPI,
  createRegistrationForm,
  createFeedbackForm,
  exportAttendance,
  closeEvent,
  toggleRegistration,
  deleteEvent
};
