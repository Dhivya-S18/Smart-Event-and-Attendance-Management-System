const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const Club = require("./models/Club");
const User = require("./models/User");

const checkCSIRequests = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const csi = await Club.findOne({ clubName: /CSI/i })
            .populate("joinRequests.studentId", "name email department registerNumber");
        
        if (!csi) {
            console.log("CSI club not found!");
            process.exit(0);
        }

        console.log("\n=================================");
        console.log(`Club: ${csi.clubName}`);
        console.log(`Pending Requests: ${csi.joinRequests.filter(r => r.status === 'pending').length}`);
        console.log(`Approved Requests: ${csi.joinRequests.filter(r => r.status === 'approved').length}`);
        console.log("=================================");
        
        if (csi.joinRequests.length === 0) {
            console.log("No join requests found.");
        } else {
            csi.joinRequests.forEach((req, i) => {
                const s = req.studentId;
                console.log(`${i+1}. ${s ? s.name : 'Unknown'} [${req.status.toUpperCase()}] - Transaction: ${req.transactionId || 'N/A'}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error("Diagnostic error:", err);
        process.exit(1);
    }
};

checkCSIRequests();
