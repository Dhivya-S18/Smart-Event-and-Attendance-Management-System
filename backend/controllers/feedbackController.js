const FeedbackResponse = require("../models/FeedbackResponse");
const FeedbackForm = require("../models/FeedbackForm");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const xlsx = require("xlsx");

const submitFeedback = async (req, res) => {
  try {
    const { eventId, studentName, email, registerNumber, department, answers } = req.body;
    let studentId = req.user ? req.user._id : null; // If student is logged in

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Check if form is published and active
    const form = await FeedbackForm.findOne({ eventId });
    if (!form || (!form.isPublished && !form.isEnabled)) {
      return res.status(400).json({ message: "Feedback form is not available for this event" });
    }

    const now = new Date();
    if (form.startTime && now < new Date(form.startTime)) {
      return res.status(403).json({ message: "Feedback form is not yet active (Available from " + new Date(form.startTime).toLocaleString() + ")" });
    }
    if (form.endTime && now > new Date(form.endTime)) {
      return res.status(403).json({ message: "Feedback form has closed at " + new Date(form.endTime).toLocaleString() });
    }

    // Identify registration
    let registration = await Registration.findOne({
      event: eventId,
      $or: [{ email: email.toLowerCase() }, { "teamMembers.email": email.toLowerCase() }]
    });

    if (!registration) {
      return res.status(403).json({ message: "Only registered students can submit feedback" });
    }

    // Determine if the submitter is the leader or a teammate
    let isLeader = registration.email.toLowerCase() === email.toLowerCase();
    let teammateIndex = -1;
    
    if (!isLeader) {
      teammateIndex = registration.teamMembers.findIndex(m => m.email.toLowerCase() === email.toLowerCase());
    }

    // Check if THIS specific person already submitted feedback
    if (isLeader && registration.feedbackSubmitted) {
      return res.status(400).json({ message: "Feedback already submitted" });
    } else if (!isLeader && teammateIndex !== -1 && registration.teamMembers[teammateIndex].feedbackSubmitted) {
      return res.status(400).json({ message: "Feedback already submitted" });
    }

    // Save feedback response (this record is independent and used for certificates)
    const feedbackResponse = await FeedbackResponse.create({
      eventId,
      studentId: studentId || (isLeader ? registration.student : null), 
      studentName,
      email: email.toLowerCase(),
      registerNumber,
      department,
      answers,
    });

    // Mark attendance and feedback status for the specific person
    if (isLeader) {
      registration.attended = true;
      registration.feedbackSubmitted = true;
    } else if (teammateIndex !== -1) {
      registration.teamMembers[teammateIndex].attended = true;
      registration.teamMembers[teammateIndex].feedbackSubmitted = true;
    }
    
    await registration.save();
    
    // Increment event attendance count
    if (event.attendance === undefined) event.attendance = 0;
    event.attendance += 1;
    await event.save();

    res.status(201).json({ message: "Feedback submitted and attendance marked", feedbackResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEventFeedbackExcel = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // We consider "Final Attendance List" as those who submitted feedback
    const feedbackResponses = await FeedbackResponse.find({ eventId });

    if (feedbackResponses.length === 0) {
      return res.status(400).json({ message: "No feedback responses found for this event" });
    }

    // Format data for Excel
    const excelData = feedbackResponses.map((response) => {
      const row = {
        "Student Name": response.studentName,
        "Register Number": response.registerNumber,
        "Department": response.department,
        "Email": response.email,
        "Feedback Submitted": "Yes",
      };
      
      // Optionally add answers to the excel
      response.answers.forEach((ans) => {
        row[(ans.questionText || "Question")] = ans.answer;
      });

      return row;
    });

    const worksheet = xlsx.utils.json_to_sheet(excelData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Final Attendance");

    const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename=attendance_${eventId}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(excelBuffer);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEventFeedback = async (req, res) => {
  try {
    const feedbacks = await FeedbackResponse.find({ eventId: req.params.eventId });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitFeedback, getEventFeedbackExcel, getEventFeedback };
