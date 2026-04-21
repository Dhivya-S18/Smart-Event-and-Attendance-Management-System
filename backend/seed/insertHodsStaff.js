const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Adjust path as needed
const dotenv = require('dotenv');

// Load environment variables
dotenv.config(); // Use default .env path from cwd

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/club-event-mgmt";

const departments = [
    "Computer Science and Engineering",
    "Information Technology",
    "Artificial Intelligence and Machine Learning",
    "Electronics and Communication Engineering",
    "Electrical and Electronics Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Science and Humanities(S&H)"
];

// Mapping to match exact names but simplified for internal use
const deptNames = ["CSE", "IT", "AI & DS", "ECE", "EEE", "MECH", "CIVIL", "S&H"];

const hodNames = [
    "Gomathi V", 
    "Senthil Kumar", 
    "Rajasekar P", 
    "Kalaiarasi M", 
    "Ramakrishnan K", 
    "Murugesan R", 
    "Kavitha S", 
    "Sivakumar T"
];

const staffNames = [
    "Sathi", "Vignesh", "Karthik", "Suresh", "Ramesh", 
    "Deepa", "Priya", "Anitha", "Gomathi", "Meena",
    "Arun", "Vijay", "Ajith", "Surya", "Vikram",
    "Sneha", "Trisha", "Nayanthara", "Samantha", "Keerthy",
    "Kamal", "Rajini", "Dhanush", "Simbu", "Siva",
    "Jyothika", "Simran", "Ramya", "Nithya", "Anushka",
    "Madhavan", "Prashanth", "Aarya", "Vishal", "Jayam",
    "Asin", "Genelia", "Hansika", "Kajal", "Tamannaah"
];

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB...");

        const hashedPassword = await bcrypt.hash("password123", 10);

        const newUsers = [];
        let rollCounter = 2310000;

        // 1. Generate 1 HOD (for CSE only)
        for (let i = 0; i < 1; i++) { // ONLY ONE HOD
            const dept = departments[i];
            const deptAbbr = deptNames[i];
            const hodName = hodNames[i];
            
            newUsers.push({
                _id: new mongoose.Types.ObjectId(),
                name: hodName,
                email: `divya965517@gmail.com`, // Unique test email
                password: hashedPassword,
                role: 'hod',
                department: dept,
                registerNumber: `HOD-${deptAbbr}`, // Unique ID for HOD
                isSetup: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        // 2. Generate 1 Staff (for CSE only)
        for (let i = 0; i < 1; i++) { // ONLY ONE STAFF
            const dept = departments[i];
            
            newUsers.push({
                _id: new mongoose.Types.ObjectId(),
                name: staffNames[0],
                email: `gurusinnakkalai@gmail.com`, // Unique test email
                password: hashedPassword,
                role: 'staff',
                department: dept,
                registerNumber: rollCounter.toString(), // Unique ID for staff
                gender: "Male",
                isSetup: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        // Insert all into the database
        console.log(`Prepared ${newUsers.length} users. Inserting into database...`);
        await User.insertMany(newUsers);

        console.log("Seed complete! Inserted 8 HODs and 40 Staff users.");
        process.exit(0);

    } catch (err) {
        console.error("Error inserting data:", err);
        process.exit(1);
    }
};

seedData();
