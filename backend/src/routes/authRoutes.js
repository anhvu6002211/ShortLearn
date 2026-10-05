const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  requestOtp,
  resetPassword,
  verifyOtp,
} = require('../controllers/authController');

const router = express.Router();

function limiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message, code: 'rate_limited' },
  });
}

const credentialLimiter = limiter({
  windowMs: 15 * 60_000,
  max: Number(process.env.AUTH_ATTEMPTS_PER_15_MINUTES || 15),
  message: 'Too many authentication attempts. Try again later.',
});
const otpRequestLimiter = limiter({
  windowMs: 15 * 60_000,
  max: Number(process.env.OTP_REQUESTS_PER_15_MINUTES || 5),
  message: 'Too many verification codes requested. Try again later.',
});
const refreshLimiter = limiter({
  windowMs: 60_000,
  max: Number(process.env.REFRESH_REQUESTS_PER_MINUTE || 30),
  message: 'Too many refresh attempts. Try again shortly.',
});

router.post('/register', credentialLimiter, register);
router.post('/login', credentialLimiter, login);
router.post('/otp/request', otpRequestLimiter, requestOtp);
router.post('/otp/verify', credentialLimiter, verifyOtp);
router.post('/forgot-password', otpRequestLimiter, forgotPassword);
router.post('/reset-password', credentialLimiter, resetPassword);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', refreshLimiter, logout);

module.exports = router;
