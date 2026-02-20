USE login_db;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol ENUM('admin', 'asesor') NOT NULL DEFAULT 'asesor',
  ADD COLUMN IF NOT EXISTS activo TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE usuarios
  MODIFY COLUMN rol ENUM('admin', 'asesor') NOT NULL DEFAULT 'asesor';
