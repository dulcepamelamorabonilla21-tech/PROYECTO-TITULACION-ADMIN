const pool = require('../config/db');

async function listClients(_req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id, nombre, email, telefono, servicio, mensaje, fecha_creacion
       FROM leads
       ORDER BY fecha_creacion DESC
       LIMIT 500`
    );

    return res.json({ success: true, clients: rows, source: 'leads' });
  } catch (error) {
    console.error('Error listando clientes:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { listClients };
