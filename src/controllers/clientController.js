const pool = require('../config/db');
const { sendLeadAssignedEmail } = require('../utils/mailer');

async function getLeadsColumns(connection) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads'`
  );
  return new Set(rows.map((r) => String(r.COLUMN_NAME)));
}

async function listClients(_req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const columns = await getLeadsColumns(connection);
    const hasAssignmentCols = columns.has('asesor_id');
    let rows = [];

    if (hasAssignmentCols) {
      [rows] = await connection.query(
        `SELECT l.id, l.nombre, l.email, l.telefono, l.servicio, l.mensaje, l.fecha_creacion,
                l.asesor_id, u.nombre AS asesor_nombre, u.email AS asesor_email, u.activo AS asesor_activo
         FROM leads l
         LEFT JOIN usuarios u ON u.id = l.asesor_id AND u.rol = 'asesor'
         ORDER BY l.fecha_creacion DESC
         LIMIT 500`
      );
    } else {
      [rows] = await connection.query(
        `SELECT l.id, l.nombre, l.email, l.telefono, l.servicio, l.mensaje, l.fecha_creacion
         FROM leads l
         ORDER BY l.fecha_creacion DESC
         LIMIT 500`
      );
      rows = rows.map((row) => ({
        ...row,
        asesor_id: null,
        asesor_nombre: null,
        asesor_email: null
      }));
    }

    return res.json({
      success: true,
      clients: rows,
      source: 'leads',
      assignmentEnabled: hasAssignmentCols
    });
  } catch (error) {
    console.error('Error listando clientes:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

async function assignLeadToAdvisor(req, res) {
  let connection;
  try {
    const leadId = Number(req.params.id);
    const advisorId = Number(req.body?.asesorId);

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return res.status(400).json({ success: false, message: 'ID de lead invalido' });
    }

    if (!Number.isInteger(advisorId) || advisorId <= 0) {
      return res.status(400).json({ success: false, message: 'ID de asesor invalido' });
    }

    connection = await pool.getConnection();
    const columns = await getLeadsColumns(connection);
    const requiredCols = ['asesor_id', 'asignado_en', 'asignado_por_admin_id'];
    const missingCols = requiredCols.filter((c) => !columns.has(c));
    if (missingCols.length) {
      return res.status(400).json({
        success: false,
        message: `Faltan columnas en leads (${missingCols.join(', ')}). Ejecuta migration_add_lead_assignment.sql`
      });
    }

    const [advisors] = await connection.query(
      `SELECT id, nombre
       FROM usuarios
       WHERE id = ? AND rol = 'asesor' AND activo = 1
       LIMIT 1`,
      [advisorId]
    );

    if (!advisors.length) {
      return res.status(404).json({ success: false, message: 'Asesor activo no encontrado' });
    }

    const [result] = await connection.query(
      `UPDATE leads
       SET asesor_id = ?, asignado_en = NOW(), asignado_por_admin_id = ?
       WHERE id = ?`,
      [advisorId, req.userId, leadId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Lead no encontrado' });
    }

    const [advisorEmailRows] = await connection.query(
      `SELECT nombre, email
       FROM usuarios
       WHERE id = ? AND rol = 'asesor'
       LIMIT 1`,
      [advisorId]
    );

    const [leadRows] = await connection.query(
      `SELECT id, nombre, email, telefono, servicio
       FROM leads
       WHERE id = ?
       LIMIT 1`,
      [leadId]
    );

    let emailStatus = { sent: false, reason: 'Datos insuficientes' };
    if (advisorEmailRows.length && leadRows.length && advisorEmailRows[0].email) {
      try {
        emailStatus = await sendLeadAssignedEmail({
          to: advisorEmailRows[0].email,
          advisorName: advisorEmailRows[0].nombre,
          lead: leadRows[0]
        });
      } catch (mailError) {
        emailStatus = { sent: false, reason: mailError.message || 'No se pudo enviar el correo' };
        console.error('Error enviando correo de lead asignado:', mailError);
      }
    }

    return res.json({
      success: true,
      message: `Lead asignado correctamente a ${advisors[0].nombre}`,
      email: emailStatus
    });
  } catch (error) {
    console.error('Error asignando lead a asesor:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { listClients, assignLeadToAdvisor };
