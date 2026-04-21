const mongoose = require('mongoose');
const path = require('path');

async function checkEvent() {
    try {
        // Try standard local mongo
        await mongoose.connect('mongodb://127.0.0.1:27017/club_event_management');
        console.log("Connected to DB");
        
        const Event = require('./models/Event');
        const Report = require('./models/Report');
        
        const event = await Event.findOne({ title: /Online Quiz Challenge/i });
        
        if (!event) {
            console.log("Event 'Online Quiz Challenge' not found.");
            // List all events to see what we have
            const allEvents = await Event.find({}, 'title status');
            console.log("Existing events:", allEvents.map(e => `${e.title} (${e.status})`).join(', '));
            process.exit(0);
        }
        
        console.log("Event Found:");
        console.log("ID:", event._id);
        console.log("Status:", event.status);
        
        const report = await Report.findOne({ eventId: event._id });
        if (report) {
            console.log("Report exists for this event.");
            console.log("Description (length):", report.description?.length || 0);
            console.log("Winners Count:", report.winners?.length || 0);
            console.log("Full Report Data:", JSON.stringify(report, null, 2));
        } else {
            console.log("No report found for this event.");
        }
        
        process.exit(0);
    } catch (e) {
        console.error("Error during diagnostic:", e);
        process.exit(1);
    }
}

checkEvent();
