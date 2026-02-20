const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function login(req, res) {
  let connection;
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
    }

    connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, nombre, email, contraseña, rol, activo FROM usuarios WHERE email = ? LIMIT 1',
      [email]
    );

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const user = users[0];
    if (user.rol !== 'admin' || Number(user.activo) !== 1) {
      return res.status(403).json({ success: false, message: 'Solo administradores autorizados' });
    }

    const match = await bcrypt.compare(password, user.contraseña);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '8h' }
    );

    return res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
  } catch (error) {
    console.error('Error login admin:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { login };
