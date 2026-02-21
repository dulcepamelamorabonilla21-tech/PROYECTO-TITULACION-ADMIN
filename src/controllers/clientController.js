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

async function isNormalizedSchemaReady(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('servicios_catalogo', 'lead_asignaciones', 'lead_seguimientos', 'lead_estados', 'contacto_canales')`
  );
  return Number(rows?.[0]?.total || 0) === 5;
}

function hasTrackingColumns(columns) {
  return (
    columns.has('estatus_seguimiento') &&
    columns.has('contacto_exitoso') &&
    columns.has('canal_ultimo_contacto') &&
    columns.has('proxima_accion') &&
    columns.has('motivo_perdido') &&
    columns.has('comentarios_asesor') &&
    columns.has('fecha_ultimo_contacto') &&
    columns.has('proximo_contacto')
  );
}

async function listClients(_req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const normalizedReady = await isNormalizedSchemaReady(connection);
    const columns = await getLeadsColumns(connection);
    let rows = [];

    if (normalizedReady) {
      [rows] = await connection.query(
        `SELECT l.id, l.nombre, l.email, l.telefono, sc.codigo AS servicio, l.mensaje, l.fecha_creacion,
                la.asesor_id, u.nombre AS asesor_nombre, u.email AS asesor_email, u.activo AS asesor_activo
         FROM leads l
         INNER JOIN servicios_catalogo sc ON sc.id = l.servicio_id
         LEFT JOIN lead_asignaciones la ON la.lead_id = l.id AND la.activo = 1
         LEFT JOIN usuarios u ON u.id = la.asesor_id AND u.rol = 'asesor'
         ORDER BY l.fecha_creacion DESC
         LIMIT 500`
      );
    } else if (columns.has('asesor_id')) {
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
      assignmentEnabled: normalizedReady || columns.has('asesor_id')
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
    const normalizedReady = await isNormalizedSchemaReady(connection);
    const columns = await getLeadsColumns(connection);

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

    let affectedRows = 0;
    if (normalizedReady) {
      const [leadRows] = await connection.query(
        `SELECT id
         FROM leads
         WHERE id = ?
         LIMIT 1`,
        [leadId]
      );

      if (!leadRows.length) {
        return res.status(404).json({ success: false, message: 'Lead no encontrado' });
      }

      await connection.beginTransaction();
      await connection.query(
        `UPDATE lead_asignaciones
         SET activo = 0, desasignado_en = NOW()
         WHERE lead_id = ? AND activo = 1`,
        [leadId]
      );

      const [insertResult] = await connection.query(
        `INSERT INTO lead_asignaciones (lead_id, asesor_id, asignado_por_admin_id, asignado_en, activo)
         VALUES (?, ?, ?, NOW(), 1)`,
        [leadId, advisorId, req.userId]
      );
      affectedRows = insertResult.affectedRows;
      await connection.commit();
    } else {
      const requiredCols = ['asesor_id', 'asignado_en', 'asignado_por_admin_id'];
      const missingCols = requiredCols.filter((c) => !columns.has(c));
      if (missingCols.length) {
        return res.status(400).json({
          success: false,
          message: `Faltan columnas en leads (${missingCols.join(', ')}). Ejecuta migration_add_lead_assignment.sql`
        });
      }

      const [result] = await connection.query(
        `UPDATE leads
         SET asesor_id = ?, asignado_en = NOW(), asignado_por_admin_id = ?
         WHERE id = ?`,
        [advisorId, req.userId, leadId]
      );
      affectedRows = result.affectedRows;
    }

    if (affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Lead no encontrado' });
    }

    const [advisorEmailRows] = await connection.query(
      `SELECT nombre, email
       FROM usuarios
       WHERE id = ? AND rol = 'asesor'
       LIMIT 1`,
      [advisorId]
    );

    const [leadRows] = normalizedReady
      ? await connection.query(
        `SELECT l.id, l.nombre, l.email, l.telefono, sc.codigo AS servicio
         FROM leads l
         INNER JOIN servicios_catalogo sc ON sc.id = l.servicio_id
         WHERE l.id = ?
         LIMIT 1`,
        [leadId]
      )
      : await connection.query(
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
    if (connection) {
      try { await connection.rollback(); } catch (_e) {}
    }
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

async function listLeadTracking(_req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const normalizedReady = await isNormalizedSchemaReady(connection);
    const columns = await getLeadsColumns(connection);
    const trackingEnabled = hasTrackingColumns(columns);

    let rows = [];
    if (normalizedReady) {
      [rows] = await connection.query(
        `SELECT l.id, l.nombre, l.email, l.telefono, sc.codigo AS servicio, l.fecha_creacion,
                la.asesor_id, u.nombre AS asesor_nombre, u.email AS asesor_email, u.activo AS asesor_activo,
                est.codigo AS estatus_seguimiento,
                CASE WHEN est.codigo IN ('no_contactado', 'perdido') THEN 0 ELSE 1 END AS contacto_exitoso,
                cc.codigo AS canal_ultimo_contacto,
                ls.proxima_accion, ls.motivo_perdido, ls.comentarios_asesor,
                ls.fecha_ultimo_contacto, ls.proximo_contacto, ls.videollamada_solicitada, ls.videollamada_fecha
         FROM leads l
         INNER JOIN servicios_catalogo sc ON sc.id = l.servicio_id
         LEFT JOIN lead_asignaciones la ON la.lead_id = l.id AND la.activo = 1
         LEFT JOIN usuarios u ON u.id = la.asesor_id AND u.rol = 'asesor'
         LEFT JOIN lead_seguimientos ls ON ls.lead_id = l.id
         LEFT JOIN lead_estados est ON est.id = ls.estado_id
         LEFT JOIN contacto_canales cc ON cc.id = ls.canal_id
         ORDER BY l.fecha_creacion DESC
         LIMIT 700`
      );

      rows = rows.map((item) => ({
        ...item,
        estatus_seguimiento: item.estatus_seguimiento || 'nuevo',
        contacto_exitoso: Number(item.contacto_exitoso || 0),
        canal_ultimo_contacto: item.canal_ultimo_contacto || null,
        proxima_accion: item.proxima_accion || null,
        motivo_perdido: item.motivo_perdido || null,
        comentarios_asesor: item.comentarios_asesor || null,
        fecha_ultimo_contacto: item.fecha_ultimo_contacto || null,
        proximo_contacto: item.proximo_contacto || null,
        videollamada_solicitada: Number(item.videollamada_solicitada || 0),
        videollamada_fecha: item.videollamada_fecha || null
      }));
    } else if (trackingEnabled) {
      [rows] = await connection.query(
        `SELECT l.id, l.nombre, l.email, l.telefono, l.servicio, l.fecha_creacion,
                l.asesor_id, u.nombre AS asesor_nombre, u.email AS asesor_email, u.activo AS asesor_activo,
                l.estatus_seguimiento, l.contacto_exitoso, l.canal_ultimo_contacto,
                l.proxima_accion, l.motivo_perdido, l.comentarios_asesor,
                l.fecha_ultimo_contacto, l.proximo_contacto, l.videollamada_solicitada, l.videollamada_fecha
         FROM leads l
         LEFT JOIN usuarios u ON u.id = l.asesor_id AND u.rol = 'asesor'
         ORDER BY l.fecha_creacion DESC
         LIMIT 700`
      );
    } else {
      [rows] = await connection.query(
        `SELECT l.id, l.nombre, l.email, l.telefono, l.servicio, l.fecha_creacion,
                l.asesor_id, u.nombre AS asesor_nombre, u.email AS asesor_email, u.activo AS asesor_activo
         FROM leads l
         LEFT JOIN usuarios u ON u.id = l.asesor_id AND u.rol = 'asesor'
         ORDER BY l.fecha_creacion DESC
         LIMIT 700`
      );

      rows = rows.map((item) => ({
        ...item,
        estatus_seguimiento: 'nuevo',
        contacto_exitoso: 0,
        canal_ultimo_contacto: null,
        proxima_accion: null,
        motivo_perdido: null,
        comentarios_asesor: null,
        fecha_ultimo_contacto: null,
        proximo_contacto: null,
        videollamada_solicitada: 0,
        videollamada_fecha: null
      }));
    }

    return res.json({ success: true, tracking: rows, trackingEnabled: normalizedReady || trackingEnabled });
  } catch (error) {
    console.error('Error listando seguimiento de leads:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { listClients, assignLeadToAdvisor, listLeadTracking };
