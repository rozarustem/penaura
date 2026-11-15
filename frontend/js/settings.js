/**
 * ============================================================
 *  Penaura — Settings Page Controller (js/settings.js)
 *  Sozlamalar (settings.html) backend (API) bilan ishlaydi:
 *    GET/PATCH /auth/me/            — ism, shahar, bio, telefon, avatar (multipart)
 *    POST /auth/change-password/    — old_password, new_password
 *    POST /auth/delete-account/     — hisobni o'chirish (parol bilan tasdiqlanadi)
 *  Email o'zgartirilmaydi (backendda read-only).
 * ============================================================
 */
(function () {
  const $ = id => document.getElementById(id);
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  let me = null;

  function showStatus(id, message, ok) {
    const el = $(id);
    if (!el) return;
    el.textContent = message || '';
    el.className = 'form-status' + (message ? (ok ? ' is-ok' : ' is-error') : '');
  }

  function setBusy(form, busy) {
    const btn = form.querySelector('.btn-save');
    if (btn) btn.disabled = busy;
  }

  function renderAvatar(user) {
    const box = $('avatar-preview');
    if (!box) return;
    const safe = PenauraDOM.getSafeImageUrl(user.avatar);
    if (safe) {
      const img = document.createElement('img');
      img.src = safe;
      img.alt = user.full_name || '';
      img.addEventListener('error', () => renderAvatar({ ...user, avatar: '' }));
      box.replaceChildren(img);
    } else {
      const initial = document.createElement('span');
      initial.className = 'profile-avatar-initial';
      initial.textContent = (user.full_name || 'U').trim().charAt(0).toUpperCase() || 'U';
      box.replaceChildren(initial);
    }
  }

  function fillForms(user) {
    $('settings-name').value = user.full_name || '';
    $('settings-city').value = user.city || '';
    $('settings-bio').value = user.bio || '';
    $('settings-email').value = user.email || '';
    $('settings-phone').value = user.phone || '';
    renderAvatar(user);
  }

  async function patchMe(body) {
    const updated = await PenauraApi.request('/auth/me/', { method: 'PATCH', body });
    me = updated;
    PenauraApi.syncUser(updated);
    return updated;
  }

  function initNav() {
    const back = document.querySelector('.profile-back-link');
    if (back) back.setAttribute('href', me.role === 'writer' ? 'writer_profil.html' : 'reader_profil.html');

    const links = Array.from(document.querySelectorAll('.settings-nav a[href^="#settings-"]'));
    const sync = () => {
      const active = window.location.hash || '#settings-general';
      links.forEach(link => {
        const on = link.getAttribute('href') === active;
        link.classList.toggle('active', on);
        if (on) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    };
    sync();
    window.addEventListener('hashchange', sync);
  }

  function initProfileForm() {
    const form = $('profile-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const name = $('settings-name').value.trim();
      if (!name) { showStatus('profile-status', 'Iltimos, ismingizni kiriting.', false); return; }
      setBusy(form, true);
      showStatus('profile-status', 'Saqlanmoqda…', true);
      try {
        const updated = await patchMe({
          full_name: name,
          city: $('settings-city').value.trim(),
          bio: $('settings-bio').value.trim(),
        });
        renderAvatar(updated);
        showStatus('profile-status', 'Profil saqlandi ✓', true);
      } catch (error) {
        showStatus('profile-status', error.message, false);
      } finally {
        setBusy(form, false);
      }
    });
  }

  function initContactForm() {
    const form = $('contact-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      setBusy(form, true);
      showStatus('contact-status', 'Saqlanmoqda…', true);
      try {
        await patchMe({ phone: $('settings-phone').value.trim() });
        showStatus('contact-status', 'Saqlandi ✓', true);
      } catch (error) {
        showStatus('contact-status', error.message, false);
      } finally {
        setBusy(form, false);
      }
    });
  }

  function initPasswordForm() {
    const form = $('password-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const oldPassword = $('pw-old').value;
      const newPassword = $('pw-new').value;
      const confirm = $('pw-confirm').value;

      if (!oldPassword) { showStatus('password-status', 'Hozirgi parolni kiriting.', false); return; }
      if (newPassword.length < 8) { showStatus('password-status', 'Yangi parol kamida 8 ta belgidan iborat bo\'lishi kerak.', false); return; }
      if (newPassword !== confirm) { showStatus('password-status', 'Yangi parol va tasdiqlash paroli mos kelmadi.', false); return; }

      setBusy(form, true);
      showStatus('password-status', 'Yangilanmoqda…', true);
      try {
        await PenauraApi.request('/auth/change-password/', {
          method: 'POST',
          body: { old_password: oldPassword, new_password: newPassword },
        });
        form.reset();
        showStatus('password-status', 'Parol yangilandi ✓', true);
      } catch (error) {
        showStatus('password-status', error.message, false);
      } finally {
        setBusy(form, false);
      }
    });
  }

  function initAvatar() {
    const input = $('avatar-input');
    $('avatar-pick').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      if (!AVATAR_TYPES.includes(file.type)) { showStatus('avatar-status', 'Faqat JPG, PNG yoki WEBP rasm yuklang.', false); return; }
      if (file.size > AVATAR_MAX_BYTES) { showStatus('avatar-status', 'Rasm hajmi 2 MB dan oshmasligi kerak.', false); return; }

      const data = new FormData();
      data.append('avatar', file);
      showStatus('avatar-status', 'Yuklanmoqda…', true);
      try {
        const updated = await patchMe(data);
        renderAvatar(updated);
        showStatus('avatar-status', 'Rasm yangilandi ✓', true);
      } catch (error) {
        showStatus('avatar-status', error.message, false);
      }
    });
  }

  function initDelete() {
    const form = $('delete-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = $('delete-password').value;
      if (!password) { showStatus('delete-status', 'Tasdiqlash uchun parolni kiriting.', false); return; }
      if (!confirm('Haqiqatan ham hisobingizni butunlay o\'chirmoqchimisiz? Bu amalni ortga qaytarib bo\'lmaydi.')) return;

      const btn = $('delete-btn');
      btn.disabled = true;
      showStatus('delete-status', 'O\'chirilmoqda…', true);
      try {
        await PenauraApi.request('/auth/delete-account/', { method: 'POST', body: { password } });
        PenauraApi.logout();
        alert('Hisobingiz o\'chirildi.');
        window.location.href = 'index.html';
      } catch (error) {
        btn.disabled = false;
        showStatus('delete-status', error.message, false);
      }
    });
  }

  function initLanguage() {
    const CODES = { "O'zbek": 'uz', 'English': 'en', 'Русский': 'ru' };
    const stored = localStorage.getItem('penaura_lang');
    // Joriy til: i18n.js yuklangan bo'lsa u beradi, bo'lmasa saqlangan qiymat (eski versiya nom bilan yozgan)
    const current = (window.PenauraI18n && PenauraI18n.getLang()) || CODES[stored] || stored || 'en';

    document.querySelectorAll('.lang-option').forEach(option => {
      const radio = option.querySelector('input[type="radio"]');
      const nameEl = option.querySelector('.name');
      if (!radio || !nameEl) return;
      const code = CODES[nameEl.textContent.trim()];
      if (!code) return;
      radio.checked = (code === current);
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        if (window.PenauraI18n) PenauraI18n.setLang(code); // sahifa darhol shu tilga o'tadi
        else localStorage.setItem('penaura_lang', code);
      });
    });
  }

  async function init() {
    if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }
    try {
      me = await PenauraApi.request('/auth/me/');
    } catch (error) {
      return; // 401 bo'lsa api-client signin ga yo'naltiradi
    }
    PenauraApi.syncUser(me);
    fillForms(me);
    initNav();
    initProfileForm();
    initContactForm();
    initPasswordForm();
    initAvatar();
    initDelete();
    initLanguage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();