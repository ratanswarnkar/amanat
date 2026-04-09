const restrictNomineeWrite = (req, res, next) => {
  if (req.user?.role === 'nominee') {
    return res.status(403).json({
      success: false,
      message: 'Nominee access is read-only',
    });
  }

  return next();
};

module.exports = restrictNomineeWrite;
