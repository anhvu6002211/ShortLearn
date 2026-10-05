const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { requestSubtitles, getSubtitles } = require('../controllers/subtitleController');

// Chi phí AI cao hơn route thông thường, giới hạn 60 video/giờ/IP.
const subtitleRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.SUBTITLE_RATE_LIMIT_PER_HOUR || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Subtitle request limit reached. Please try again later.' },
});

// Đăng ký nhận phụ đề video (tạo task nếu chưa có)
router.post('/request', subtitleRequestLimiter, requestSubtitles);

// Lấy phụ đề theo video ID
router.get('/:videoId', getSubtitles);

module.exports = router;
