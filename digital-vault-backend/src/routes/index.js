const express = require('express');

const { getRootMessage } = require('../controllers/healthController');

const router = express.Router();

router.get('/', getRootMessage);

module.exports = router;
