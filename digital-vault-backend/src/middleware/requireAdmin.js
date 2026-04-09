const authMiddleware = require('./authMiddleware');

const requireAdmin = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.currentUser?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    return next();
  });
};

module.exports = requireAdmin;
