require('dotenv').config();
const path = require('path');
const express = require('express');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5100;
const HOST = process.env.HOST || '127.0.0.1';

app.use(express.json());

app.use(express.static(path.join(__dirname, 'src/views')));
app.use('/images', express.static(path.join(__dirname, 'src/images')));
app.use('/api/admin', adminRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'admin-panel' });
});

app.listen(PORT, HOST, () => {
  console.log(`Admin panel corriendo en http://${HOST}:${PORT}`);
});
