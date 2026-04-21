const FeedbackForm = require("../models/FeedbackForm");
const Event = require("../models/Event");
const { generateQRCodeDataURL } = require("../utils/imageGenerator");

const defaultQuestions = [
  { questionText: "Rate the event", type: "rating", required: true },
  { questionText: "How was the event organization?", type: "text", required: true },
  { questionText: "Was the event useful?", type: "boolean", required: true },
  { questionText: "Suggestions for improvement", type: "text", required: false },
];

const createFeedbackForm = async (req, res) => {
  try {
    const { eventId } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Check if form already exists
    const existingForm = await FeedbackForm.findOne({ eventId });
    if (existingForm) return res.status(400).json({ message: "Feedback form already exists for this event" });

    const form = await FeedbackForm.create({
      eventId,
      questions: defaultQuestions,
      createdBy: req.user._id,
    });

    res.status(201).json({ message: "Feedback form created successfully", form });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateFeedbackForm = async (req, res) => {
  try {
    const { questions, startTime, endTime } = req.body;
    const form = await FeedbackForm.findById(req.params.id);

    if (form.isPublished) {
      // If published, only allow updating endTime
      if (questions || startTime) {
        return res.status(400).json({ message: "Cannot edit questions or start time on a published form." });
      }
      if (endTime) {
        form.endTime = new Date(endTime);
        await form.save();
        return res.status(200).json({ message: "Feedback time extended successfully", form });
      }
      return res.status(400).json({ message: "Cannot edit a published form" });
    }

    if (questions) form.questions = questions;
    if (startTime) form.startTime = new Date(startTime);
    if (endTime) form.endTime = new Date(endTime);

    await form.save();

    res.status(200).json({ message: "Feedback form updated successfully", form });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const publishFeedbackForm = async (req, res) => {
  try {
    const form = await FeedbackForm.findById(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });

    form.isPublished = true;
    form.isEnabled = true;

    // Generate feedback link and QR code if not present
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const feedbackUrl = `${frontendUrl}/feedback-form.html?id=${form.eventId}`;
    form.feedbackLink = feedbackUrl;
    
    const qrDataUrl = await generateQRCodeDataURL(feedbackUrl);
    form.qrCodeUrl = qrDataUrl;

    await form.save();

    const event = await Event.findById(form.eventId);
    event.feedbackEnabled = true;
    event.registrationEnabled = false;
    await event.save();

    res.status(200).json({ message: "Feedback form published successfully!", form });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFeedbackForm = async (req, res) => {
  try {
    const form = await FeedbackForm.findOne({ eventId: req.params.eventId });
    if (!form) return res.status(404).json({ message: "Form not found" });

    res.status(200).json(form);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFeedbackQR = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const feedbackUrl = `${frontendUrl}/feedback-form.html?id=${eventId}`;
    const qrDataUrl = await generateQRCodeDataURL(feedbackUrl);

    res.status(200).json({ qrDataUrl, feedbackUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createFeedbackForm, updateFeedbackForm, publishFeedbackForm, getFeedbackForm, getFeedbackQR };
