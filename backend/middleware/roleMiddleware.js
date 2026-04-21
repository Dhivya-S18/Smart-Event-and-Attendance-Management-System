const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user ? req.user.role : 'undefined'} is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { authorize };
