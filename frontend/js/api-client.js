const PenauraApi = (() => {
  // Lokal ishlab chiqishda API 127.0.0.1:8000 da; serverda sayt va API bitta domen ostida (/api/).
  // Kerak bo'lsa, sahifada window.PENAURA_API_URL bilan qo'lda belgilash mumkin.
  const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
  const baseUrl = window.PENAURA_API_URL || (IS_LOCAL ? 'http://127.0.0.1:8000/api' : '/api');
  const ACCESS_KEY = 'penaura_access';
  const REFRESH_KEY = 'penaura_refresh';

  function getAccessToken() {
    return localStorage.getItem(ACCESS_KEY);
  }

  /* Backend foydalanuvchisini (UserSerializer) saytdagi currentUser formatiga o'tkazadi. */
  function toCurrentUser(user) {
    return {
      id: String(user.id),
      name: user.full_name,
      email: user.email,
      role: user.role,
      bio: user.bio || '',
      phone: user.phone || '',
      city: user.city || '',
      avatar: user.avatar || '',
    };
  }

  /* /auth/me/ javobidan keyin Storage dagi currentUser ni yangilash (ism, avatar navbarda ham o'zgaradi). */
  function syncUser(user) {
    const currentUser = toCurrentUser(user);
    if (window.Storage) Storage.setCurrentUser(currentUser);
    return currentUser;
  }

  function setSession(data) {
    localStorage.setItem(ACCESS_KEY, data.access);
    localStorage.setItem(REFRESH_KEY, data.refresh);
    return syncUser(data.user);
  }

  /* Access token muddati tugasa (60 daqiqa), refresh token bilan yangisini olamiz. */
  async function refreshAccess() {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const r = await fetch(`${baseUrl}/auth/refresh/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }),
      });
      if (!r.ok) return false;
      const t = await r.json();
      localStorage.setItem(ACCESS_KEY, t.access);
      if (t.refresh) localStorage.setItem(REFRESH_KEY, t.refresh);
      return true;
    } catch (e) { return false; }
  }

  async function request(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const token = getAccessToken();
    if (token && !options.public) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    });
    if (response.status === 401 && !options.public) {
      if (retry && await refreshAccess()) return request(path, options, false);
      logout();
      setTimeout(() => { if (!/signin\.html/.test(location.pathname)) location.href = 'signin.html'; }, 1200);
      throw new Error('Sessiya muddati tugadi. Iltimos, qaytadan kiring.');
    }
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body && (body.detail || Object.values(body).flat().join(' '));
      const error = new Error(detail || `Server xatosi (${response.status}).`);
      error.status = response.status;
      error.code = body && body.code;
      throw error;
    }
    return body;
  }

  async function login(email, password) {
    const result = await request('/auth/login/', {
      method: 'POST', public: true, body: { email, password },
    });
    return setSession(result);
  }

  /* Ro'yxatdan o'tadi. Email tasdiqlanmaguncha kirib bo'lmaydi, shuning uchun login qilinmaydi:
     foydalanuvchi emailiga kelgan kodni verify.html sahifasida kiritadi. */
  async function register(user) {
    return request('/auth/register/', {
      method: 'POST', public: true,
      body: {
        full_name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role,
      },
    });
  }

  function logout() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    if (window.Storage) Storage.setCurrentUser(null);
  }

  if (window.Storage && !getAccessToken() && Storage.getCurrentUser()) Storage.setCurrentUser(null);

  return { request, login, register, logout, getAccessToken, syncUser };
})();