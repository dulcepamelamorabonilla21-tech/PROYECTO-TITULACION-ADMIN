const jwt = require('jsonwebtoken');

function verifyAdminToken(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Acceso denegado' });
    }

    req.userId = decoded.id;
    req.userEmail = decoded.email;
    req.userRole = decoded.rol;
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
}

module.exports = { verifyAdminToken };
