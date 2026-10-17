const form = document.querySelector('#login-form');
const statusBox = document.querySelector('#status');
const submitButton = document.querySelector('#submit-button');
document.querySelector('#year').textContent = new Date().getFullYear();

function setStatus(message, success = false) {
  statusBox.textContent = message;
  statusBox.className = success ? 'status success' : 'status';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const apiBase = (window.VIRTUAL_PLATFORM_CONFIG?.API_BASE_URL || '').replace(/\/$/, '');
  if (!apiBase || apiBase.includes('REPLACE-WITH-YOUR-BACKEND-URL')) {
    setStatus('The platform administrator must configure the backend URL before login is available.');
    return;
  }
  submitButton.disabled = true;
  setStatus('Signing in…');
  try {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username.value.trim(),
        password: form.password.value,
        role: form.role.value
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
    setStatus('Login succeeded. The next stage is to connect your learning dashboard.', true);
    // Do not redirect until role-specific frontend pages are implemented and tested.
  } catch (error) {
    setStatus(error.message || 'Could not contact the login service. Check the backend URL and deployment.');
  } finally {
    submitButton.disabled = false;
  }
});
