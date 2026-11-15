/**
 * ============================================================
 *  Penaura — Brauzerdagi joriy foydalanuvchi keshi (js/storage.js)
 *
 *  Ma'lumotlar (foydalanuvchilar, kitoblar, she'rlar, maqolalar, tangalar,
 *  baho va bookmark) SERVERDA saqlanadi: Django backend (db.sqlite3).
 *
 *  Brauzerda (localStorage) faqat shular turadi:
 *    penaura_current_user          — navbar uchun joriy foydalanuvchi nusxasi
 *    penaura_access / penaura_refresh — kirish tokenlari (js/api-client.js boshqaradi)
 *    penaura_lang                  — til tanlovi (js/settings.js)
 * ============================================================
 */

const CURRENT_USER_KEY = 'penaura_current_user';

/* Eski (backendsiz) versiya brauzerga yozib qo'ygan ma'lumotlar — endi kerak emas.
   Ichida test foydalanuvchilarning ochiq parollari ham bor edi, shuning uchun tozalab tashlaymiz. */
['penaura_users', 'penaura_books', 'penaura_poems', 'penaura_articles', 'penaura_seeded_v3']
  .forEach(key => localStorage.removeItem(key));

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)) || null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
  } else {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }
}

/* Joriy foydalanuvchi nusxasini yangilaydi (boshqa foydalanuvchilarni brauzerda saqlamaymiz). */
function saveUser(user) {
  const current = getCurrentUser();
  if (!user || !current) return user;
  const sameUser = (current.id && current.id === user.id)
    || (current.email && user.email && current.email.toLowerCase() === user.email.toLowerCase());
  if (sameUser) setCurrentUser({ ...current, ...user });
  return user;
}

function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem('penaura_access');
  localStorage.removeItem('penaura_refresh');
}

/* Boshqa fayllar `Storage.getCurrentUser()` ko'rinishida chaqiradi */
window.Storage = {
  getCurrentUser,
  setCurrentUser,
  saveUser,
  logout,
};

/* Til (i18n) tizimi: js/i18n.js ni storage.js ulangan barcha sahifalarga avtomatik ulaydi */
(function () {
  if (window.PenauraI18n || document.querySelector('script[data-penaura-i18n]')) return;
  const me = document.currentScript;
  if (!me || !me.src) return;
  const loader = document.createElement('script');
  loader.src = me.src.replace(/storage\.js(\?.*)?$/, 'i18n.js');
  loader.setAttribute('data-penaura-i18n', '');
  document.head.appendChild(loader);
})();