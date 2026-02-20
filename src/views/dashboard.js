const token = localStorage.getItem('admin_token');
const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

if (!token) {
  window.location.href = '/login.html';
}

const adminInfo = document.getElementById('adminInfo');
const form = document.getElementById('advisorForm');
const msg = document.getElementById('msg');
const advisorTable = document.getElementById('advisorTable');
const logoutBtn = document.getElementById('logoutBtn');

adminInfo.textContent = `Sesión: ${adminUser.nombre || ''} (${adminUser.email || ''})`;

function setMsg(text, ok) {
  msg.textContent = text;
  msg.className = `msg ${ok ? 'ok' : 'err'}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Error en servidor');
  }
  return data;
}

function renderAdvisors(rows) {
  advisorTable.innerHTML = '';
  rows.forEach((item) => {
    const isActive = Number(item.activo) === 1;
    const actionLabel = isActive ? 'Inactivar' : 'Activar';
    const actionNext = isActive ? 0 : 1;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${item.nombre}</td>
      <td>${item.email}</td>
      <td><span class="badge">${isActive ? 'Activo' : 'Inactivo'}</span></td>
      <td>${item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleString('es-MX') : '-'}</td>
      <td>
        <button
          type="button"
          class="toggle-advisor-btn"
          data-id="${item.id}"
          data-next="${actionNext}"
          style="width:auto;padding:6px 10px;"
        >${actionLabel}</button>
      </td>
    `;
    advisorTable.appendChild(tr);
  });
}

async function loadAdvisors() {
  try {
    const data = await api('/api/admin/asesores', { method: 'GET' });
    renderAdvisors(data.advisors || []);
  } catch (error) {
    setMsg(error.message, false);
    if (/token/i.test(error.message)) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login.html';
    }
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('', false);

  const payload = {
    nombre: document.getElementById('nombre').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
    confirmPassword: document.getElementById('confirmPassword').value
  };

  try {
    const data = await api('/api/admin/asesores', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setMsg(data.message || 'Asesor creado', true);
    form.reset();
    await loadAdvisors();
  } catch (error) {
    setMsg(error.message, false);
  }
});

advisorTable.addEventListener('click', async (event) => {
  const btn = event.target.closest('.toggle-advisor-btn');
  if (!btn) return;

  const advisorId = btn.dataset.id;
  const nextStatus = Number(btn.dataset.next);

  try {
    const data = await api(`/api/admin/asesores/${advisorId}/activo`, {
      method: 'PATCH',
      body: JSON.stringify({ activo: nextStatus })
    });
    setMsg(data.message || 'Estatus actualizado', true);
    await loadAdvisors();
  } catch (error) {
    setMsg(error.message, false);
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/login.html';
});

loadAdvisors();
