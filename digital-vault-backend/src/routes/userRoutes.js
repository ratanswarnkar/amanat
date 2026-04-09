const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const { getUserRoles } = require('../controllers/userRoleController');

const router = express.Router();

router.use(authMiddleware);
router.get('/roles', getUserRoles);

module.exports = router;
