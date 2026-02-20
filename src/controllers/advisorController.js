const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function isAllowedDomain(email) {
  const allowed = String(process.env.ALLOWED_ADVISOR_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.length) return true;
  const domain = String(email).split('@')[1]?.toLowerCase() || '';
  return allowed.includes(domain);
}

async function createAdvisor(req, res) {
  let connection;
  try {
    const { nombre, email, password, confirmPassword } = req.body;

    if (!nombre || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener mínimo 8 caracteres' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Email inválido' });
    }

    if (!isAllowedDomain(email)) {
      return res.status(403).json({ success: false, message: 'Dominio de correo no permitido para asesores' });
    }

    connection = await pool.getConnection();

    const [exists] = await connection.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email]);
    if (exists.length) {
      return res.status(409).json({ success: false, message: 'El email ya existe' });
    }

    const hash = await bcrypt.hash(password, 10);
    await connection.query(
      'INSERT INTO usuarios (nombre, email, contraseña, rol, activo) VALUES (?, ?, ?, ?, ?)',
      [nombre, email, hash, 'asesor', 1]
    );

    return res.status(201).json({ success: true, message: 'Asesor creado correctamente' });
  } catch (error) {
    console.error('Error creando asesor:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

async function listAdvisors(_req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT id, nombre, email, activo, fecha_creacion FROM usuarios WHERE rol = ? ORDER BY id DESC',
      ['asesor']
    );

    return res.json({ success: true, advisors: rows });
  } catch (error) {
    console.error('Error listando asesores:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

async function updateAdvisorStatus(req, res) {
  let connection;
  try {
    const advisorId = Number(req.params.id);
    const nextStatus = Number(req.body?.activo);

    if (!Number.isInteger(advisorId) || advisorId <= 0) {
      return res.status(400).json({ success: false, message: 'ID de asesor inválido' });
    }

    if (![0, 1].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Estatus inválido' });
    }

    connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE usuarios SET activo = ? WHERE id = ? AND rol = ?',
      [nextStatus, advisorId, 'asesor']
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Asesor no encontrado' });
    }

    return res.json({
      success: true,
      message: nextStatus === 1 ? 'Asesor activado correctamente' : 'Asesor inactivado correctamente'
    });
  } catch (error) {
    console.error('Error actualizando estatus de asesor:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { createAdvisor, listAdvisors, updateAdvisorStatus };
