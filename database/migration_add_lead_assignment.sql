USE login_db;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS asesor_id INT NULL,
  ADD COLUMN IF NOT EXISTS asignado_en TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS asignado_por_admin_id INT NULL,
  ADD INDEX IF NOT EXISTS idx_leads_asesor_id (asesor_id),
  ADD INDEX IF NOT EXISTS idx_leads_asignado_por_admin_id (asignado_por_admin_id);
