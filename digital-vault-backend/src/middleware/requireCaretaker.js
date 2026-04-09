const requireCaretaker = (req, res, next) => {
  if (req.user?.role !== 'caretaker') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
    });
  }

  return next();
};

module.exports = requireCaretaker;
