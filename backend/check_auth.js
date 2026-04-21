const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://divya965517_db_user:Dhivya2005@cluster0.yypy3ow.mongodb.net/eventdb?retryWrites=true&w=majority';

async function checkEventAndUser() {
    try {
        await mongoose.connect(MONGO_URI);
        const Event = require('./models/Event');
        const Club = require('./models/Club');
        const User = require('./models/User');
        
        const event = await Event.findOne({ title: /Online Quiz Challenge/i });
        if (!event) { console.log("Event not found"); process.exit(0); }
        
        console.log("Event ID:", event._id);
        console.log("Event Club ID:", event.clubId);
        
        const hostClub = await Club.findById(event.clubId);
        if (hostClub) {
            console.log("Host Club Name:", hostClub.clubName);
            console.log("Host Club Student Coordinators:", hostClub.studentCoordinators);
        }

        // Check if there are ANY students who can see this event in completed list
        // Based on eventController.js filtering
        const potentialCoordinators = await User.find({ _id: { $in: hostClub?.studentCoordinators || [] } });
        console.log("Authorized Student Coordinators for this club:", potentialCoordinators.map(u => `${u.name} (${u.email})`));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkEventAndUser();
