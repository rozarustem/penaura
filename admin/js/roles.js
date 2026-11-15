/* Rollar, sidebar va kirish tekshiruvi.
   Kirish backend orqali (/auth/admin-login/, JWT) amalga oshadi. localStorage'da faqat tokenlar va
   interfeys uchun sessiya nusxasi turadi: rol har sahifada verifySession() bilan serverdan tekshiriladi,
   haqiqiy ruxsatni esa backend har so'rovda o'zi tekshiradi. */
const ROLES = {
  direktor:  { label: "Direktor",  home: "dashboard.html" },
  moliyachi: { label: "Moliyachi", home: "dashboard.html" },
  moderator: { label: "Moderator", home: "books.html" },
  tahrirchi: { label: "Tahrirchi", home: "editorial.html" }
};

const NAV = [
  { title: "Moliya", items: [
    { href: "dashboard.html",   text: "Moliya paneli",       roles: ["direktor","moliyachi"] },
    { href: "transaction.html", text: "Tranzaksiyalar",      roles: ["direktor","moliyachi"] },
    { href: "coin_sales.html",  text: "Tanga sotuvi",        roles: ["direktor","moliyachi"] },
    { href: "payouts.html",     text: "Yozuvchilarga to'lov",roles: ["direktor","moliyachi"] },
    { href: "reports.html",     text: "Hisobotlar",          roles: ["direktor","moliyachi"] }
  ]},
  { title: "Kontent", items: [
    { href: "books.html",     text: "Kitoblar",  roles: ["direktor","moderator","tahrirchi"] },
    { href: "editorial.html", text: "Tahririyat",roles: ["direktor","tahrirchi"] },
    { href: "articles.html",  text: "Blog",      roles: ["direktor"] }
  ]},
  { title: "Foydalanuvchilar", items: [
    { href: "users.html", text: "Foydalanuvchilar", roles: ["direktor","moderator"] }
  ]},
  { title: "Tizim", items: [
    { href: "settings.html",  text: "Sozlamalar",    roles: ["direktor","moliyachi"] },
    { href: "audit_log.html", text: "Audit jurnali", roles: ["direktor"] }
  ]}
];

/* Menyuda ko'rinmaydigan ichki sahifalar: qaysi menyu bandiga tegishli ekanini ko'rsatadi. */
const SUBPAGES = { "manuscript.html": "editorial.html", "manuscript-chapter.html": "editorial.html", "user.html": "users.html", "article-edit.html": "articles.html" };
function pageKey() {
  const p = location.pathname.split("/").pop() || "dashboard.html";
  /* Moderator asar sahifalarini «Kitoblar» ichidan ochadi (Tahririyat menyusi unga yo'q). */
  if (p === "manuscript.html" || p === "manuscript-chapter.html") {
    const s = typeof getSession === "function" ? getSession() : null;
    if (s && s.role === "moderator") return "books.html";
  }
  return SUBPAGES[p] || p;
}

const AdminApi = (() => {
  // Lokal ishlab chiqishda API 127.0.0.1:8000 da; serverda admin panel va API bitta domen ostida (/api/).
  const IS_LOCAL = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
  const baseUrl = window.PENAURA_API_URL || (IS_LOCAL ? "http://127.0.0.1:8000/api" : "/api");
  const ACCESS_KEY = "penaura_admin_access";
  const REFRESH_KEY = "penaura_admin_refresh";

  async function request(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const token = localStorage.getItem(ACCESS_KEY);
    if (token && !options.public) headers.set("Authorization", "Bearer " + token);
    let response = await fetch(baseUrl + path, {
      ...options, headers,
      body: options.body instanceof FormData ? options.body :
        options.body ? JSON.stringify(options.body) : undefined
    });
    if (response.status === 401 && retry && !options.public) {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh) {
        const refreshed = await fetch(baseUrl + "/auth/refresh/", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh })
        });
        if (refreshed.ok) {
          const tokens = await refreshed.json();
          localStorage.setItem(ACCESS_KEY, tokens.access);
          return request(path, options, false);
        }
      }
      logout();
    }
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data && (data.detail || Object.values(data).flat().join(" "));
      throw new Error(detail || "Server xatosi (" + response.status + ").");
    }
    return data;
  }

  return { request };
})();

function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem("penaura_admin"));
    return session && session.access && ROLES[session.role] ? session : null;
  } catch (e) { return null; }
}
function setSession(data) {
  const session = {
    name: data.user.full_name,
    email: data.user.email,
    role: data.user.role,
    access: data.access,
    refresh: data.refresh
  };
  localStorage.setItem("penaura_admin_access", data.access);
  localStorage.setItem("penaura_admin_refresh", data.refresh);
  localStorage.setItem("penaura_admin", JSON.stringify(session));
  return session;
}
function logout() {
  try { localStorage.removeItem("penaura_admin"); } catch (e) {}
  localStorage.removeItem("penaura_admin_access");
  localStorage.removeItem("penaura_admin_refresh");
  location.href = "login.html";
}

/* Rol va holatni serverdan tekshiradi: localStorage dagi sessiyaga ishonib qolmaymiz.
   Rol o'zgargan bo'lsa sessiya yangilanadi, xodim bo'lmay qolgan yoki bloklangan bo'lsa chiqariladi.
   (Haqiqiy ruxsatni baribir backend har so'rovda tekshiradi.) */
async function verifySession() {
  const s = getSession(); if (!s) return;
  try {
    const me = await AdminApi.request("/auth/me/");
    if (!ROLES[me.role]) { logout(); return; }
    if (me.role !== s.role || me.full_name !== s.name) {
      s.role = me.role; s.name = me.full_name;
      localStorage.setItem("penaura_admin", JSON.stringify(s));
      location.reload();
    }
  } catch (e) {
    if (/bloklangan/i.test((e && e.message) || "")) logout();   /* tarmoq xatosida sahifani to'xtatmaymiz */
  }
}

/* Har bir admin sahifasi boshida chaqiriladi: kirmagan yoki ruxsati yo'q bo'lsa yo'naltiradi. */
function requireAccess() {
  const s = getSession();
  if (!s || !ROLES[s.role]) { location.replace("login.html"); return null; }
  const page = pageKey();
  const allowed = NAV.some(g => g.items.some(i => i.href === page && i.roles.includes(s.role)));
  if (!allowed) { location.replace(ROLES[s.role].home); return null; }
  return s;
}

function renderSidebar(session) {
  const el = document.getElementById("sidebar");
  if (!el) return;
  const page = pageKey();
  const brand = document.createElement("div");
  brand.className = "brand"; brand.textContent = "Penaura";
  const nav = document.createElement("nav");
  nav.className = "nav"; nav.setAttribute("aria-label", "Asosiy menyu");
  NAV.forEach(g => {
    const items = g.items.filter(i => i.roles.includes(session.role));
    if (!items.length) return;
    const t = document.createElement("div");
    t.className = "nav-title"; t.textContent = g.title; nav.appendChild(t);
    items.forEach(i => {
      const a = document.createElement("a");
      a.href = i.href; a.textContent = i.text;
      if (i.href === page) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
  });
  const me = document.createElement("div");
  me.className = "me";
  const n = document.createElement("strong"); n.textContent = session.name || "Administrator";
  const r = document.createElement("span"); r.textContent = ROLES[session.role].label;
  const b = document.createElement("button"); b.type = "button"; b.textContent = "Chiqish";
  b.addEventListener("click", logout);
  me.append(n, r, b);
  el.append(brand, nav, me);
}