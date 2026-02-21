const express = require('express');
const { login } = require('../controllers/adminAuthController');
const { createAdvisor, listAdvisors, updateAdvisorStatus, resetAdvisorPassword } = require('../controllers/advisorController');
const { listClients, assignLeadToAdvisor, listLeadTracking } = require('../controllers/clientController');
const { verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/asesores', verifyAdminToken, createAdvisor);
router.get('/asesores', verifyAdminToken, listAdvisors);
router.patch('/asesores/:id/activo', verifyAdminToken, updateAdvisorStatus);
router.patch('/asesores/:id/reset-password', verifyAdminToken, resetAdvisorPassword);
router.get('/clientes', verifyAdminToken, listClients);
router.get('/clientes/seguimiento', verifyAdminToken, listLeadTracking);
router.patch('/clientes/:id/asignar', verifyAdminToken, assignLeadToAdvisor);

module.exports = router;
