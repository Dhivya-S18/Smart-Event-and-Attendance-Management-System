const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Club = require("../models/Club");

const seedClubs = async () => {
  try {
    const adminEmail = "admin@college.edu";
    console.log("Ensuring super admin exists...");
    await User.findOneAndUpdate(
      { email: adminEmail },
      { 
        name: "Super Admin",
        role: "admin",
        password: await bcrypt.hash("admin123", 10) // Note: actual seeding should use a more secure way to handle passwords if they change
      },
      { upsert: true, new: true }
    );

    const hodEmail = "hod@college.edu";
    console.log("Ensuring HOD CSE exists and has department...");
    await User.findOneAndUpdate(
      { email: hodEmail },
      {
        name: "HOD CSE",
        role: "hod",
        department: "Computer Science",
        password: await bcrypt.hash("hod123", 10)
      },
      { upsert: true, new: true }
    );

    const clubNames = [
      "Coding Club", "AI Club", "Robotics Club", "Cyber Security Club",
      "Web Development Club", "Design Club", "Photography Club",
      "Entrepreneurship Club", "Gaming Club", "Cultural Club"
    ];

    for (const name of clubNames) {
      const staff1Email = `${name.toLowerCase().replace(/ /g, "")}.staff1@college.edu`;
      const staff2Email = `${name.toLowerCase().replace(/ /g, "")}.staff2@college.edu`;
      
      let staff1 = await User.findOne({ email: staff1Email });
      if (!staff1) {
        staff1 = await User.create({
          name: `${name} Staff 1`,
          email: staff1Email,
          password: "staff123",
          role: "staff",
        });
      }

      let staff2 = await User.findOne({ email: staff2Email });
      if (!staff2) {
        staff2 = await User.create({
          name: `${name} Staff 2`,
          email: staff2Email,
          password: "staff123",
          role: "staff",
        });
      }

      let club = await Club.findOne({ clubName: name });
      if (!club) {
        club = await Club.create({
          clubName: name,
          description: `Official ${name} of the college.`,
          clubType: "independent",
          staffCoordinators: [staff1._id, staff2._id],
          department: "Computer Science", // Default for seeding
          members: []
        });
        
        staff1.clubId = club._id;
        staff1.department = "Computer Science";
        await staff1.save();

        staff2.clubId = club._id;
        staff2.department = "Computer Science";
        await staff2.save();

        let firstStudent = null;
        for (let i = 1; i <= 5; i++) {
          const studentEmail = `${name.toLowerCase().replace(/ /g, "")}.student${i}@college.edu`;
          const student = await User.create({
            name: `${name} Student ${i}`,
            email: studentEmail,
            password: "student123",
            role: "student",
            clubId: club._id,
            isClubMember: true,
            department: "Computer Science",
            registerNumber: `REG-${name.substring(0,3).toUpperCase()}-${1000 + i}`
          });
          if (i === 1) firstStudent = student;
          club.members.push(student._id);
        }

        // Set Student Coordinator
        club.studentCoordinators = [firstStudent._id];

        // Add mock events
        const Event = require("../models/Event");
        await Event.create({
          title: `${name} Inauguration`,
          description: `Opening ceremony for ${name}`,
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
          venue: "Main Hall",
          clubId: club._id,
          createdBy: firstStudent._id,
          status: "published",
          published: true,
          staffApproved: true,
          hodApproved: true,
          department: "Computer Science"
        });

        await Event.create({
          title: `${name} Workshop`,
          description: `Hands-on workshop by ${name}`,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
          venue: "Lab 204",
          clubId: club._id,
          createdBy: firstStudent._id,
          status: "published",
          hodApproved: true,
          staffApproved: true,
          department: "Computer Science"
        });

        await club.save();
      }
    }

    console.log("Seeding completed successfully.");
  } catch (error) {
    console.error("Seeding failed:", error.message);
  }
};

module.exports = seedClubs;
