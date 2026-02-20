const express = require('express');
const { login } = require('../controllers/adminAuthController');
const { createAdvisor, listAdvisors, updateAdvisorStatus } = require('../controllers/advisorController');
const { verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/asesores', verifyAdminToken, createAdvisor);
router.get('/asesores', verifyAdminToken, listAdvisors);
router.patch('/asesores/:id/activo', verifyAdminToken, updateAdvisorStatus);

module.exports = router;
