/**
 * Penaura — Parolni unutdim (forgot-password.html)
 * POST /auth/password-reset/ {email}. Javob email mavjudligidan qat'i nazar bir xil.
 */
document.addEventListener('DOMContentLoaded', function () {
  const box = document.getElementById('signin-alert');
  function showAlert(message, ok) {
    box.style.display = 'block';
    box.style.background = ok ? 'rgba(74, 150, 96, 0.15)' : 'rgba(181, 98, 46, 0.15)';
    box.style.color = ok ? '#2d6a4f' : 'var(--terracotta)';
    box.style.border = ok ? '1px solid #74c69d' : '1px solid var(--terracotta-soft)';
    box.textContent = message;
  }

  const form = document.getElementById('signin-form');
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    if (!email) { showAlert('Iltimos, email manzilingizni kiriting.', false); return; }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await PenauraApi.request('/auth/password-reset/', {
        method: 'POST', public: true, body: { email },
      });
      showAlert((result && result.detail) || 'Havola yuborildi.', true);
      form.reset();
    } catch (error) {
      showAlert(error.message || 'So\'rovni yuborib bo\'lmadi.', false);
    } finally {
      button.disabled = false;
    }
  });
});