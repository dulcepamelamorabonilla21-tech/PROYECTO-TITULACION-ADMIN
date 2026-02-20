const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');

function setMsg(text, ok) {
  msg.textContent = text;
  msg.className = `msg ${ok ? 'ok' : 'err'}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('', false);

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo iniciar sesión');
    }

    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(data.user || {}));
    window.location.href = '/dashboard.html';
  } catch (error) {
    setMsg(error.message, false);
  }
});
