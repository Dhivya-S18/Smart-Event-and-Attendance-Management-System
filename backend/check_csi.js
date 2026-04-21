const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const Club = require("./models/Club");
const User = require("./models/User");

const checkCSI = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const csi = await Club.findOne({ clubName: /CSI/i })
            .populate("members", "name email department registerNumber");
        
        if (!csi) {
            console.log("CSI club not found!");
            process.exit(0);
        }

        console.log("\n=================================");
        console.log(`Club: ${csi.clubName} (${csi._id})`);
        console.log(`Member count: ${csi.members.length}`);
        console.log("=================================");
        
        if (csi.members.length === 0) {
            console.log("No members found in this club.");
        } else {
            csi.members.forEach((m, i) => {
                console.log(`${i+1}. ${m.name} [${m.registerNumber}] - ${m.email} (${m.department})`);
            });
        }
        
        console.log("\n---------------------------------");
        console.log("Checking for members in other organizations...");
        const allClubs = await Club.find({}).select("clubName members");
        for (const club of allClubs) {
            if (club.members.length > 0) {
                console.log(`${club.clubName}: ${club.members.length} members`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error("Diagnostic error:", err);
        process.exit(1);
    }
};

checkCSI();
