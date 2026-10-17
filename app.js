
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

  const apiBase = (
    window.VIRTUAL_PLATFORM_CONFIG?.API_BASE_URL || ''
  ).replace(/\/$/, '');

  if (
    !apiBase ||
    apiBase.includes('REPLACE-WITH-YOUR-BACKEND-URL')
  ) {
    setStatus(
      'The platform administrator must configure the backend URL before login is available.'
    );
    return;
  }

  submitButton.disabled = true;
  setStatus('Connecting to the platform service…');

  try {
    const response = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Functions'
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `Request failed (${response.status}).`
      );
    }

    if (data.status === 'running') {
      setStatus(
        'Backend connection successful! Secure login is not enabled yet.',
        true
      );
    } else {
      setStatus(
        'The backend responded, but it is not yet configured for login.'
      );
    }
  } catch (error) {
    console.error('Backend connection error:', error);

    setStatus(
      'Could not connect to the backend. Please check the function deployment and browser connection.'
    );
  } finally {
    submitButton.disabled = false;
  }
});
