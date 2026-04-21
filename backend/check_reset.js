const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
// Set up to run from backend/ directory
const User = require('./models/User');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkUser() {
    try {
        console.log("🔗 Connecting to:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to DB");

        const testToken = "51ae47d7198efd3dfe79dc987b06b64cdf83da04";
        const testHash = crypto.createHash("sha256").update(testToken).digest("hex");
        
        console.log("\n🧪 Searching for Token:");
        console.log("   Raw Token:", testToken);
        console.log("   Target Hash:", testHash);

        const usersWithTokens = await User.find({ resetPasswordToken: { $exists: true, $ne: null } });
        console.log(`\n📋 Found ${usersWithTokens.length} users with reset tokens:`);
        
        usersWithTokens.forEach(u => {
            console.log(`-----------------------------------`);
            console.log(`Email: ${u.email}`);
            console.log(`Token in DB: ${u.resetPasswordToken}`);
            console.log(`Expires: ${u.resetPasswordExpire}`);
            
            const testToken = "51ae47d7198efd3dfe79dc987b06b64cdf83da04";
            const hashedTest = crypto.createHash("sha256").update(testToken).digest("hex");
            
            if (u.resetPasswordToken === testToken) {
                console.log(`✅ MATCHED RAW TOKEN! (Wait, why is it raw in DB?)`);
            } else if (u.resetPasswordToken === hashedTest) {
                console.log(`✅ MATCHED HASHED TOKEN!`);
            } else {
                console.log(`❌ NO MATCH`);
            }
        });
    } catch (err) {
        console.error("🔥 Error:", err.message);
    }
    process.exit();
}

checkUser();

