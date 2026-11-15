/* Blog maqolalari — backend (Django REST) bilan ishlaydi.

   Oqim: sahifa avval `await Articles.load()` (yoki `Articles.boot(...)`) bilan ro'yxatni yuklaydi,
   keyin o'qish funksiyalari (all, get) oldingidek sinxron ishlaydi.
   Yozish funksiyalari (save, setStatus, remove) API ga so'rov yuboradi va Promise qaytaradi.

   Maqola: { id (= slug), slug, title, category, author, date, readTime, summary, content, status }.
   status: 'draft' (qoralama, faqat adminda) yoki 'published' (blogda ko'rinadi).
   Backendda maqola matni HTML (<p>...</p>) bo'lib saqlanadi; muharrirda oddiy matn:
   paragraflar orasida bo'sh qator. Faqat direktor yozadi. */
const Articles = (() => {
  const api = (path, options) => AdminApi.request(path, options);
  const CATEGORIES = ["WRITING TIPS", "AUTHOR INTERVIEW", "PUBLISHING GUIDE", "COMMUNITY", "PLATFORM NEWS"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let LIST = [];

  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const words = t => String(t || "").trim().split(/\s+/).filter(Boolean).length;
  const readTime = t => Math.max(1, Math.ceil(words(t) / 200)) + " min read";
  const st = a => a.status || "draft";
  const fmtDate = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? MON[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() : ""; };

  /* oddiy matn -> HTML paragraflar (backend shuni saqlaydi va tozalaydi) */
  const textToHtml = t => String(t || "").replace(/\s+$/, "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>").join("");
  /* HTML -> muharrir uchun oddiy matn (allaqachon oddiy matn bo'lsa o'zgarmaydi) */
  function htmlToText(html) {
    const s = String(html || "");
    if (!/<[a-z][\s\S]*>/i.test(s)) return s;
    const doc = new DOMParser().parseFromString(s, "text/html");
    doc.querySelectorAll("br").forEach(b => b.replaceWith("\n"));
    const blocks = [...doc.querySelectorAll("p,h2,h3,blockquote,li")].filter(b => !b.parentElement.closest("p,h2,h3,blockquote,li"));
    const parts = blocks.length ? blocks.map(b => b.textContent.trim()) : [doc.body.textContent.trim()];
    return parts.filter(Boolean).join("\n\n");
  }

  const view = a => ({ id: a.slug, slug: a.slug, title: a.title, category: a.category, author: a.author, summary: a.summary || "",
    content: htmlToText(a.content), cover: a.cover || "", status: a.status, date: fmtDate(a.published_at), readTime: a.read_time || readTime(a.content) });

  /* Barcha maqolalar (qoralamalar ham): backend sahifalab beradi, hammasini yig'amiz */
  async function load() {
    let out = [], page = 1;
    for (;;) {
      const d = await api("/articles/?scope=all&page=" + page);
      const rows = Array.isArray(d) ? d : (d.results || []);
      out = out.concat(rows);
      if (Array.isArray(d) || !d.next || !rows.length) break;
      page++;
    }
    LIST = out.map(view);
  }
  /* Ro'yxat sahifasi: kirishni tekshiradi, ma'lumotni yuklaydi, keyin run() ni chaqiradi. */
  async function boot(run) {
    if (!getSession()) { location.replace("login.html"); return; }
    try { await load(); } catch (e) {
      Admin.page({ title: "Ma'lumotni yuklab bo'lmadi", sub: (e && e.message) || "Server bilan aloqa yo'q. Backend ishlayotganini tekshiring.", sections: [] });
      return;
    }
    run();
  }

  /* Ro'yxatda topilmasa, maqolani slug bo'yicha bevosita so'raydi (topilmasa null qaytaradi) */
  async function fetchOne(id) {
    try {
      const v = view(await api("/articles/" + encodeURIComponent(id) + "/"));
      const i = LIST.findIndex(a => a.id === v.id); if (i >= 0) LIST[i] = v; else LIST.unshift(v);
      return v;
    } catch (e) { return null; }
  }

  const all = () => LIST;
  const get = id => LIST.find(a => a.id === id) || null;

  /* data: { id?, title, category, author, summary, content, status, cover?: File, removeCover?: bool } -> saqlangan maqola
     Rasm tanlangan (yoki olib tashlanayotgan) bo'lsa so'rov multipart (FormData), aks holda JSON bo'ladi. */
  function payload(fields, data) {
    const hasFile = typeof File !== "undefined" && data.cover instanceof File;
    if (!hasFile && !data.removeCover) return fields;
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    if (hasFile) fd.append("cover", data.cover);
    else fd.append("remove_cover", "true");
    return fd;
  }
  async function save(data) {
    const body = { title: data.title.trim(), category: data.category, author: data.author.trim(),
      summary: data.summary.trim(), content: textToHtml(data.content) };
    let saved;
    if (data.id) {
      saved = await api("/articles/" + encodeURIComponent(data.id) + "/", { method: "PATCH", body: payload({ ...body, status: data.status }, data) });
    } else {
      saved = await api("/articles/", { method: "POST", body: payload(body, data) });          /* yangi maqola har doim qoralama bo'lib yaratiladi */
      if (data.status === "published") saved = await api("/articles/" + encodeURIComponent(saved.slug) + "/", { method: "PATCH", body: { status: "published" } });
    }
    const v = view(saved), i = LIST.findIndex(a => a.id === v.id);
    if (i >= 0) LIST[i] = v; else LIST.unshift(v);
    return v;
  }
  async function setStatus(id, status) {
    const v = view(await api("/articles/" + encodeURIComponent(id) + "/", { method: "PATCH", body: { status } }));
    const i = LIST.findIndex(a => a.id === id); if (i >= 0) LIST[i] = v;
    return v;
  }
  async function remove(id) {
    await api("/articles/" + encodeURIComponent(id) + "/", { method: "DELETE" });
    LIST = LIST.filter(a => a.id !== id);
  }

  return { all, get, fetchOne, load, boot, save, setStatus, remove, st, words, readTime, CATEGORIES };
})();