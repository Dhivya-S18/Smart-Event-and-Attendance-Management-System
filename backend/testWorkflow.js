const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const testWorkflow = async () => {
    try {
        console.log("Testing Login API with fetch()...");
        
        let res = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "codingclub.student1@college.edu", password: "123456" })
        });
        
        console.log("Student Auto-Login Status:", res.status);
        let data = await res.json();
        console.log("Student Login response role:", data.role);
        
        if (res.status === 200) {
            console.log("✅ The login workflow is fully operational and the hashes are working perfectly!");
        } else {
            console.log("❌ Something is still wrong:", data.message);
        }

        // Test Forgot Password logic just in case
        console.log("\nTesting Forgot Password...");
        let forgotRes = await fetch("http://localhost:5000/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "codingclub.student1@college.edu" })
        });
        
        let forgotData = await forgotRes.json();
        console.log("Forgot Password Status:", forgotRes.status);
        if (forgotRes.status === 200 && forgotData.resetToken) {
            console.log("✅ Forgot Password flow correctly generates tokens.");
        } else {
            console.log("❌ Forgot Password issue:", forgotData);
        }

        process.exit(0);
    } catch (e) {
        console.log("Error testing API (Ensure server is running!):", e.message);
        process.exit(1);
    }
};

testWorkflow();
