const express = require('express');
const router = express.Router();
const { authenticateJwt, rejectClientUserId } = require('../middleware/authenticateJwt');
const {
  saveVocabulary,
  reviewVocabulary,
  getDueVocabulary,
  getSavedVocabulary,
  updateVocabularyCards,
} = require('../controllers/vocabController');

router.use(authenticateJwt, rejectClientUserId);

// Lưu từ vựng mới vào deck SRS
router.post('/save', saveVocabulary);

// Ghi nhận kết quả ôn tập flashcard (thuật toán FSRS v5)
router.post('/review', reviewVocabulary);

// Lấy danh sách từ vựng cần ôn hôm nay
router.get('/due', getDueVocabulary);
router.get('/saved', getSavedVocabulary);

// Cáº­p nháº­t giai Ä‘oáº¡n há»c vÃ  nhÃ£n mÃ u cho má»™t/nhiá»u tháº».
router.patch('/cards', updateVocabularyCards);

module.exports = router;
