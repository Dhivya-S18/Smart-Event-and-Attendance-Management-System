const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Department = require('./models/Department');
const User = require('./models/User');

dotenv.config();

const departments = [
    { name: "Computer Science and Engineering", code: "cse" },
    { name: "Information Technology", code: "it" },
    { name: "Electronics and Communication Engineering", code: "ece" },
    { name: "Electrical and Electronics Engineering", code: "eee" },
    { name: "Mechanical Engineering", code: "mech" },
    { name: "Civil Engineering", code: "civil" },
    { name: "Artificial Intelligence and Machine Learning", code: "aiml" },
    { name: "Science and Humanities(S&H)", code: "sh" }
];

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        for (const dept of departments) {
            // 1. Ensure Department exists
            let departmentDoc = await Department.findOne({ name: dept.name });
            if (!departmentDoc) {
                departmentDoc = await Department.create({ name: dept.name });
                console.log(`Created Department: ${dept.name}`);
            }

            // 2. Ensure HOD exists
            const hodEmail = `hod${dept.code}@nec.edu.in`;
            const existingHOD = await User.findOne({ email: hodEmail });
            
            if (!existingHOD) {
                await User.create({
                    name: `HOD ${dept.name.split(' ').map(w => w[0]).join('')}`, // e.g. "HOD CSE"
                    email: hodEmail,
                    password: "hod123", 
                    role: "hod",
                    department: dept.name
                });
                console.log(`Created HOD: ${hodEmail}`);
            } else {
                console.log(`HOD already exists: ${hodEmail}`);
            }
        }

        console.log("Seeding complete!");
        process.exit();
    } catch (err) {
        console.error("Seeding error:", err);
        process.exit(1);
    }
};

seedData();
