const express = require('express');
const { getLearningInsights } = require('../controllers/learningInsightsController');
const { authenticateJwt, rejectClientUserId } = require('../middleware/authenticateJwt');

const router = express.Router();

router.use(authenticateJwt, rejectClientUserId);

router.get('/insights', getLearningInsights);

module.exports = router;
