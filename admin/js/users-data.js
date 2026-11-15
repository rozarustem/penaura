/* Foydalanuvchilar — backend (Django REST) bilan ishlaydi.

   Oqim: sahifa avval `await UsersData.load()` bilan ro'yxatni yuklaydi, keyin all() / get() sinxron ishlaydi.
   Tafsilot sahifasi `await UsersData.detail(id)` dan foydalanadi. Bloklash — setBlocked() (Promise).
   Faqat direktor va moderator ko'ra oladi (backend ham shuni tekshiradi). */
const UsersData = (() => {
  const api = (path, options) => AdminApi.request(path, options);
  const ROLE = { reader: "O'quvchi", writer: "Yozuvchi", direktor: "Direktor", moliyachi: "Moliyachi", moderator: "Moderator", tahrirchi: "Tahrirchi" };
  const pad = n => String(n).padStart(2, "0");
  const fmt = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : ""; };
  const day = iso => fmt(iso).slice(0, 10);
  let LIST = [], STATS = {};

  const view = u => ({ id: String(u.id), name: u.full_name, role: ROLE[u.role] || u.role, roleKey: u.role, email: u.email,
    phone: u.phone || "—", city: u.city || "—", bio: u.bio || "", coins: u.coins || 0, blocked: !!u.is_blocked,
    joined: day(u.date_joined), lastSeen: fmt(u.last_login) || "—" });

  /* Barcha foydalanuvchilar: backend sahifalab beradi, hammasini yig'amiz */
  async function load() {
    let out = [], page = 1;
    for (;;) {
      const d = await api("/auth/admin/users/?page_size=200&page=" + page);
      out = out.concat(d.results || []);
      STATS = d.stats || STATS;
      if (!d.next || !(d.results || []).length) break;
      page++;
    }
    LIST = out.map(view);
  }

  async function detail(id) {
    const d = await api("/auth/admin/users/" + encodeURIComponent(id) + "/");
    return { ...view(d), booksCount: d.books_count, poemsCount: d.poems_count, unlocked: d.chapters_unlocked,
      followers: d.followers_count, transactions: d.transactions || [], audit: d.audit || [] };
  }

  async function setBlocked(id, v) {
    const d = await api("/auth/admin/users/" + encodeURIComponent(id) + "/", { method: "POST", body: { is_blocked: !!v } });
    const u = LIST.find(x => x.id === String(id)); if (u) u.blocked = !!d.is_blocked;
    return !!d.is_blocked;
  }

  /* Rolni o'zgartirish — faqat direktor (backend ham shuni tekshiradi) */
  async function setRole(id, role) {
    const d = await api("/auth/admin/users/" + encodeURIComponent(id) + "/role/", { method: "POST", body: { role } });
    const u = LIST.find(x => x.id === String(id));
    if (u) { u.roleKey = d.role; u.role = ROLE[d.role] || d.role; }
    return d.role;
  }

  const get = id => LIST.find(u => u.id === String(id)) || null;
  return { load, all: () => LIST, stats: () => STATS, get, detail, setBlocked, setRole, isBlocked: id => !!(get(id) || {}).blocked, ROLE, fmt };
})();