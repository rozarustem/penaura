/**
 * Penaura — Yangi parol o'rnatish (reset-password.html)
 * Havola: reset-password.html?uid=...&token=...  ->  POST /auth/password-reset/confirm/
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

  const params = new URLSearchParams(window.location.search);
  const uid = params.get('uid');
  const token = params.get('token');
  const form = document.getElementById('signin-form');

  if (!uid || !token) {
    showAlert('Havola noto\'g\'ri. Emailingizdagi havolani to\'liq oching yoki yangisini so\'rang.', false);
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if (newPassword.length < 8) { showAlert('Yangi parol kamida 8 ta belgidan iborat bo\'lishi kerak.', false); return; }
    if (newPassword !== confirm) { showAlert('Parollar bir-biriga mos kelmadi.', false); return; }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await PenauraApi.request('/auth/password-reset/confirm/', {
        method: 'POST', public: true, body: { uid, token, new_password: newPassword },
      });
      showAlert('Parol yangilandi ✓ Kirish sahifasiga yo\'naltirilmoqda...', true);
      setTimeout(function () { window.location.href = 'signin.html'; }, 1800);
    } catch (error) {
      showAlert(error.message || 'Parolni yangilab bo\'lmadi.', false);
      button.disabled = false;
    }
  });
});