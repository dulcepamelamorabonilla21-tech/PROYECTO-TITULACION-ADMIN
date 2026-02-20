const express = require('express');
const { login } = require('../controllers/adminAuthController');
const { createAdvisor, listAdvisors, updateAdvisorStatus } = require('../controllers/advisorController');
const { listClients, assignLeadToAdvisor } = require('../controllers/clientController');
const { verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/asesores', verifyAdminToken, createAdvisor);
router.get('/asesores', verifyAdminToken, listAdvisors);
router.patch('/asesores/:id/activo', verifyAdminToken, updateAdvisorStatus);
router.get('/clientes', verifyAdminToken, listClients);
router.patch('/clientes/:id/asignar', verifyAdminToken, assignLeadToAdvisor);

module.exports = router;
