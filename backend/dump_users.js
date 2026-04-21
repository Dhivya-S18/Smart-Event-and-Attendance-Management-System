const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config({ path: './.env' });

async function dumpUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const users = await User.find({}, 'name email role resetPasswordToken resetPasswordExpire');
        console.log("All Users:");
        users.forEach(u => {
            console.log(`- ${u.name} (${u.role}): ${u.email}`);
            if (u.resetPasswordToken) {
                console.log(`  Token: ${u.resetPasswordToken.substring(0, 10)}... Expire: ${u.resetPasswordExpire}`);
            }
        });
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit();
}

dumpUsers();
