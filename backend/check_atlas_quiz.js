const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://divya965517_db_user:Dhivya2005@cluster0.yypy3ow.mongodb.net/eventdb?retryWrites=true&w=majority';

async function checkEvent() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB Atlas");
        
        const Event = require('./models/Event');
        const Report = require('./models/Report');
        
        const event = await Event.findOne({ title: /Online Quiz Challenge/i });
        
        if (!event) {
            console.log("Event 'Online Quiz Challenge' not found.");
            process.exit(0);
        }
        
        console.log("Event Details:");
        console.log("ID:", event._id);
        console.log("Status:", event.status);
        console.log("Title:", event.title);
        
        const report = await Report.findOne({ eventId: event._id });
        if (report) {
            console.log("Report Details:");
            console.log("Description:", report.description);
            console.log("Winners:", JSON.stringify(report.winners, null, 2));
            console.log("Photos Count:", report.photos.length);
        } else {
            console.log("No report found for this event.");
        }
        
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

checkEvent();
