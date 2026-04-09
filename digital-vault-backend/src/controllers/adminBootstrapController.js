const { sendError, sendOk } = require('../utils/http');
const { createAdminUser } = require('../services/adminBootstrapService');

const bootstrapAdmin = async (req, res) => {
  try {
    const adminUser = await createAdminUser({
      email: req.body?.email,
      password: req.body?.password,
      secret: req.headers['x-admin-bootstrap-secret'],
    });

    return sendOk(res, {
      message: 'Admin user created successfully',
      admin: adminUser,
    }, 201);
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message || 'Failed to create admin user', error.details);
  }
};

module.exports = {
  bootstrapAdmin,
};
