const token = localStorage.getItem('admin_token');
const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

if (!token) {
  window.location.href = '/login.html';
}

const adminInfo = document.getElementById('adminInfo');
const form = document.getElementById('advisorForm');
const msg = document.getElementById('msg');
const advisorTable = document.getElementById('advisorTable');
const clientTable = document.getElementById('clientTable');
const logoutBtn = document.getElementById('logoutBtn');
let advisorsCache = [];

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
  advisorsCache = rows || [];
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

function advisorOptions(selectedAdvisorId) {
  const activeAdvisors = advisorsCache.filter((a) => Number(a.activo) === 1);
  const baseOption = activeAdvisors.length
    ? '<option value="">Selecciona asesor activo</option>'
    : '<option value="">No hay asesores activos</option>';
  const rows = activeAdvisors.map((advisor) => {
    const selected = Number(selectedAdvisorId) === Number(advisor.id) ? 'selected' : '';
    return `<option value="${advisor.id}" ${selected}>${advisor.nombre} (${advisor.email})</option>`;
  });
  return [baseOption, ...rows].join('');
}

function renderClients(rows) {
  if (!clientTable) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    clientTable.innerHTML = '<tr><td colspan="9">Sin clientes registrados.</td></tr>';
    return;
  }
  clientTable.innerHTML = '';
  rows.forEach((item) => {
    const hasAdvisorAssigned = Number(item.asesor_id) > 0;
    const isAdvisorActive = Number(item.asesor_activo) === 1;
    const isInactiveAssigned = hasAdvisorAssigned && !isAdvisorActive;
    const assigned = item.asesor_nombre
      ? `${item.asesor_nombre} (${item.asesor_email || '-'})`
      : (hasAdvisorAssigned ? 'Asesor no disponible' : 'Sin asignar');
    const serviceLabel = (item.servicio || '-').replaceAll('_', ' ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td><div class="cell-clip" title="${item.nombre || '-'}">${item.nombre || '-'}</div></td>
      <td><div class="cell-clip" title="${item.email || '-'}">${item.email || '-'}</div></td>
      <td>${item.telefono || '-'}</td>
      <td><span class="service-tag" title="${serviceLabel}">${serviceLabel}</span></td>
      <td><div class="cell-clip message-clip" title="${item.mensaje || '-'}">${item.mensaje || '-'}</div></td>
      <td><span class="assigned-badge ${isInactiveAssigned ? 'is-inactive' : (item.asesor_nombre ? 'is-assigned' : 'is-unassigned')}">${assigned}${isInactiveAssigned ? ' - INACTIVO' : ''}</span></td>
      <td>
        <div class="assign-control">
        <select class="assign-select" data-lead-id="${item.id}">
          ${advisorOptions(item.asesor_id)}
        </select>
        <button
          type="button"
          class="assign-lead-btn assign-btn"
          data-id="${item.id}"
        >Asignar</button>
        </div>
      </td>
      <td>${item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleString('es-MX') : '-'}</td>
    `;
    clientTable.appendChild(tr);
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

async function loadClients() {
  if (!clientTable) return;
  try {
    const data = await api('/api/admin/clientes', { method: 'GET' });
    renderClients(data.clients || []);
    if (data.assignmentEnabled === false) {
      setMsg('Asignacion deshabilitada: ejecuta migration_add_lead_assignment.sql en la BD.', false);
    }
  } catch (error) {
    setMsg(error.message, false);
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
    await loadClients();
  } catch (error) {
    setMsg(error.message, false);
  }
});

clientTable.addEventListener('click', async (event) => {
  const btn = event.target.closest('.assign-lead-btn');
  if (!btn) return;

  const leadId = btn.dataset.id;
  const select = clientTable.querySelector(`select[data-lead-id="${leadId}"]`);
  const advisorId = Number(select?.value);

  if (!advisorId) {
    setMsg('Selecciona un asesor activo para asignar el lead', false);
    return;
  }

  try {
    const data = await api(`/api/admin/clientes/${leadId}/asignar`, {
      method: 'PATCH',
      body: JSON.stringify({ asesorId: advisorId })
    });
    const emailInfo = data.email?.sent
      ? ' Correo enviado al asesor.'
      : (data.email?.reason ? ` Correo no enviado: ${data.email.reason}.` : '');
    setMsg(`${data.message || 'Lead asignado'}${emailInfo}`, true);
    await loadClients();
  } catch (error) {
    setMsg(error.message, false);
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/login.html';
});

async function initDashboard() {
  await loadAdvisors();
  await loadClients();
}

initDashboard();
