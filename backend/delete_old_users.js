const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/club-event-mgmt";

const cleanup = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for cleanup...");

        const User = require('./models/User');
        const Club = require('./models/Club');
        const Association = require('./models/Association');

        console.log("Deleting old HODs, Staffs, and Students...");
        await User.deleteMany({ role: { $in: ['hod', 'staff', 'student'] } });

        console.log("Unlinking them from Clubs and Associations...");
        await Club.updateMany({}, { $set: { hods: [], staffCoordinators: [], studentCoordinators: [], members: [] } });
        await Association.updateMany({}, { $set: { hodId: null, staffCoordinators: [], studentCoordinators: [] } });

        console.log("Cleanup complete!");
        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
};

cleanup();
