const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const User = require("./models/User");
const Club = require("./models/Club");
const Association = require("./models/Association");

const checkDhivya = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const user = await User.findOne({ name: /Dhivya S/i });
        if (!user) {
            console.log("User Dhivya S not found!");
            process.exit(0);
        }

        console.log("\n=================================");
        console.log(`User: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Profile clubId: ${user.clubId}`);
        console.log(`Profile clubName: ${user.clubName}`);
        console.log(`Profile associationId: ${user.associationId}`);
        console.log("=================================");

        const clubs = await Club.find({ members: user._id }).select("clubName");
        console.log(`Member of Clubs: ${clubs.map(c => c.clubName).join(", ") || 'None'}`);

        const assocs = await Association.find({ members: user._id }).select("name");
        console.log(`Member of Associations: ${assocs.map(a => a.name).join(", ") || 'None'}`);

        const pending = await Club.find({ "joinRequests.studentId": user._id }).select("clubName joinRequests");
        console.log(`Pending requests in: ${pending.map(p => p.clubName).join(", ") || 'None'}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkDhivya();
