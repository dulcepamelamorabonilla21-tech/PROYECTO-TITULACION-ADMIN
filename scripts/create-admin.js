require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

async function run() {
  const [, , nombre, email, password] = process.argv;

  if (!nombre || !email || !password) {
    console.log('Uso: npm run create-admin -- "Nombre Admin" admin@proinvest.mx Password123');
    process.exit(1);
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const hash = await bcrypt.hash(password, 10);

    await connection.query(
      `INSERT INTO usuarios (nombre, email, contraseña, rol, activo)
       VALUES (?, ?, ?, 'admin', 1)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), contraseña = VALUES(contraseña), rol = 'admin', activo = 1`,
      [nombre, email, hash]
    );

    console.log('Admin creado/actualizado correctamente.');
  } catch (error) {
    console.error('Error creando admin:', error.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

run();
