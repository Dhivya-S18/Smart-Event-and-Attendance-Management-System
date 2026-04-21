const User = require("../models/User");
const Club = require("../models/Club");

// list of default clubs with basic info
const defaultClubs = [
  { name: "Coding Club", description: "A place for students who love to code", department: "General" },
  { name: "AI Club", description: "Exploring the world of artificial intelligence", department: "General" },
  { name: "Robotics Club", description: "Hands on robotics and automation", department: "General" },
  { name: "Cyber Security Club", description: "Learn about cyber threats and defences", department: "General" },
  { name: "Web Development Club", description: "Build websites and web apps", department: "General" },
  { name: "Design Club", description: "Graphic and UI/UX design", department: "General" },
  { name: "Photography Club", description: "Capture moments with your camera", department: "General" },
  { name: "Entrepreneurship Club", description: "Ideas, startups and business", department: "General" },
  { name: "Gaming Club", description: "All about video games and esports", department: "General" },
  { name: "Cultural Club", description: "Celebrating art, music and culture", department: "General" },
];

const defaultStaffEmails = [
  "staff1@college.com",
  "staff2@college.com",
  "staff3@college.com",
];

// Generates or fetches a staff user for the given email
async function getOrCreateStaff(email) {
  let user = await User.findOne({ email });
  if (user) return user;

  // name portion before @
  const name = email.split("@")[0];
  user = await User.create({ name, email, password: "password123", role: "staff" });
  return user;
}

// Generates or fetches a student user for the given email/name
async function getOrCreateStudent(email, name) {
  let user = await User.findOne({ email });
  if (user) return user;

  user = await User.create({ name, email, password: "password123", role: "student" });
  return user;
}

async function seedDefaults() {
  try {
    // create an admin user if missing
    const defaultAdminEmail = "admin@college.com";
    let adminUser = await User.findOne({ email: defaultAdminEmail });
    if (!adminUser) {
      adminUser = await User.create({ name: "Administrator", email: defaultAdminEmail, password: "password123", role: "admin" });
      console.log("Seed: created default admin user");
    }

    // create a sample HOD as well (optional)
    const defaultHodEmail = "hod@college.com";
    let hodUser = await User.findOne({ email: defaultHodEmail });
    if (!hodUser) {
      hodUser = await User.create({ name: "HOD", email: defaultHodEmail, password: "password123", role: "hod" });
      console.log("Seed: created default HOD user");
    }

    const staffUsers = [];
    for (const email of defaultStaffEmails) {
      const staff = await getOrCreateStaff(email);
      staffUsers.push(staff);
    }

    // student counter for unique emails (start after any existing seeded student)
    const existingStudents = await User.countDocuments({
      role: "student",
      email: /student\d+@nec\.edu\.in/,
    });
    let studentCounter = existingStudents + 1;
    let createdClubs = 0;

    for (let i = 0; i < defaultClubs.length; i++) {
      const clubInfo = defaultClubs[i];

      // check whether this club already exists by name
      const existing = await Club.findOne({ name: clubInfo.name });
      if (existing) {
        console.log(`Seed: club '${clubInfo.name}' already exists - skipping`);
        continue;
      }

      const coordinator = staffUsers[i % staffUsers.length];

      // create between 5 and 10 students for this club
      const numberOfStudents = Math.floor(Math.random() * 6) + 5; // [5,10]
      const members = [];

      for (let j = 0; j < numberOfStudents; j++) {
        const email = `student${studentCounter}@nec.edu.in`;
        const name = `Student ${studentCounter}`;
        studentCounter++;

        const student = await getOrCreateStudent(email, name);
        members.push(student);
      }

      // choose first student as president
      const president = members[0];

      const club = new Club({
        name: clubInfo.name,
        description: clubInfo.description,
        coordinator: coordinator._id,
        president: president._id,
        department: clubInfo.department || "General",
      });

      club.members = members.map((m) => m._id);
      await club.save();

      // update each student with club affiliation
      for (const m of members) {
        if (!m.club || m.club.toString() !== club._id.toString()) {
          m.club = club._id;
          m.isClubMember = true;
          await m.save();
        }
      }

      createdClubs++;
      console.log(`Seed: created club '${club.name}' with ${members.length} members.`);
    }

    if (createdClubs > 0) {
      console.log("Seed: default clubs and users created successfully.");
    } else {
      console.log("Seed: no new clubs were created (all defaults already present).");
    }
  } catch (err) {
    console.error("Seed error:", err);
  }
}

module.exports = seedDefaults;

// if run directly, connect to DB then seed
if (require.main === module) {
  const connectDB = require("../config/db");
  connectDB()
    .then(() => seedDefaults())
    .then(() => {
      console.log("Seeding completed, exiting.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
