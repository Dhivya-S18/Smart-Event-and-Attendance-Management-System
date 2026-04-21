const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      
      if (!req.user) {
        console.warn(`⚠️ Auth Failed: Ghost token detected (User ID ${decoded.id} no longer exists)`);
        return res.status(401).json({ message: "Not authorized, token corresponds to a deleted account" });
      }

      next();
    } catch (error) {
      console.error(`❌ JWT Auth Error: ${error.message} (Token: ${token?.substring(0, 10)}...)`);
      res.status(401).json({ message: "Not authorized, token failed: " + error.message });
    }
  } else {
    console.warn("⚠️ Auth Failed: No token provided in headers or query");
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

module.exports = { protect };
