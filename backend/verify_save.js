const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://divya965517_db_user:Dhivya2005@cluster0.yypy3ow.mongodb.net/eventdb?retryWrites=true&w=majority';

async function testSave() {
    try {
        await mongoose.connect(MONGO_URI);
        const Event = require('./models/Event');
        const Report = require('./models/Report');
        const User = require('./models/User');
        
        const event = await Event.findOne({ title: /Online Quiz Challenge/i });
        const user = await User.findOne({ role: 'student' }); // Any student for createdBy

        if (!event || !user) {
            console.log("Event or User not found");
            process.exit(1);
        }

        console.log("Attempting to save report for:", event.title);

        const reportData = {
            eventId: event._id.toString(),
            description: "Test description for Online Quiz Challenge.",
            rounds: [{ roundName: "Round 1", roundDescription: "Intro" }],
            winners: [{ studentName: "Test Winner", ranking: "1st", year: "2", department: "CSE" }],
            createdBy: user._id
        };

        // Simulate createOrUpdateReport logic roughly
        let report = await Report.findOne({ eventId: event._id });
        if (report) {
            console.log("Updating existing report...");
            report.description = reportData.description;
            report.winners = reportData.winners;
            await report.save();
        } else {
            console.log("Creating new report...");
            report = await Report.create(reportData);
        }

        console.log("Report saved successfully!");
        console.log("Report ID:", report._id);
        
        process.exit(0);
    } catch (e) {
        console.error("Save failed:", e);
        process.exit(1);
    }
}

testSave();
