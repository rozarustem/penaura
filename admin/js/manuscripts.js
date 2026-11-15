/* Tahririyat ma'lumot qatlami — backend (Django REST) bilan ishlaydi.

   Oqim: sahifa avval `await Manuscripts.boot(() => { ... })` bilan ma'lumotni yuklaydi (bitta so'rov),
   keyin sahifa kodi o'qish funksiyalarini (works, get, summary) oldingidek sinxron chaqiraveradi.
   Yozish funksiyalari (publish, giveBack, ...) endi API'ga so'rov yuboradi va Promise qaytaradi;
   muvaffaqiyatli bo'lsa ma'lumot qayta yuklanadi.

   Bob (yoki she'r) holatlari:  draft (yozuvchida) → submitted (Yangi) → editing (Tahrirda)
   → published (Saytda) yoki returned (yozuvchiga qaytarildi).
   Kitob tahrirchi tomonidan "olib qo'yiladi" (lock): bir vaqtda faqat bitta tahrirchi. */
const Manuscripts = (() => {
  const api = (path, options) => AdminApi.request(path, options);
  let BOOKS = [], POEMS = [];

  const LABEL = { submitted: ["Yangi", "wait"], editing: ["Tahrirda", "wait"], returned: ["Yozuvchiga qaytarildi", "err"],
    published: ["Platformada", "ok"], hidden: ["Yashirilgan", "err"], draft: ["Qoralama", "wait"] };
  const SHORT = { submitted: "Yangi", editing: "Tahrirda", returned: "Qaytarilgan", published: "Platformada", hidden: "Yashirilgan", draft: "Qoralama" };
  const badge = key => Admin.B(LABEL[key][0], LABEL[key][1]);

  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const toHtml = c => /<p(\s|>)/i.test(c || "") ? c : "<p>" + esc(c || "").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
  const words = html => (new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent || "").trim().split(/\s+/).filter(Boolean).length;
  const OK = new Set(["p", "br", "strong", "em", "b", "i", "u", "blockquote", "h2", "h3", "ul", "ol", "li"]);
  const BAD = new Set(["script", "style", "iframe", "object", "svg", "math"]);
  function safeHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html"), out = document.createElement("div");
    (function walk(src, dst) {
      src.childNodes.forEach(n => {
        if (n.nodeType === 3) dst.append(document.createTextNode(n.nodeValue));
        else if (n.nodeType === 1) {
          const t = n.tagName.toLowerCase(); if (BAD.has(t)) return;
          if (!OK.has(t)) { walk(n, dst); return; }
          const e = document.createElement(t); walk(n, e); dst.append(e);
        }
      });
    })(doc.body, out);
    return out.innerHTML;
  }

  /* "2026-10-16 14:05" (mahalliy vaqt) */
  const fmt = iso => {
    if (!iso) return "";
    const d = new Date(iso), p = n => String(n).padStart(2, "0");
    if (isNaN(d)) return String(iso).slice(0, 16).replace("T", " ");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  };

  const session = () => (typeof getSession === "function" && getSession()) || {};
  const me = () => session().name || "tahrirchi";
  const isDirector = () => session().role === "direktor";
  /* Kirgan foydalanuvchi id'si — JWT ichidagi user_id (band qilgan tahrirchini aniqlash uchun) */
  const meId = () => {
    try {
      const t = localStorage.getItem("penaura_admin_access");
      return String(JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).user_id);
    } catch (e) { return ""; }
  };
  const isMine = w => !!(w && w.lock && w.lock.byId === meId());

  /* ---------- API javobini sahifa kutgan ko'rinishga o'tkazish ---------- */
  const lockOf = x => x.lock_user ? { by: x.lock_user_name || "Tahrirchi", byId: String(x.lock_user), at: fmt(x.lock_at) } : null;
  const chView = c => ({ id: String(c.id), title: c.title || "Nomsiz", content: c.content || "", isPremium: !!c.is_premium, status: c.status,
    edited: !!c.edited || c.status === "published", editorNote: c.editor_note || "",
    submittedAt: fmt(c.submitted_at || c.created_at), updatedAt: fmt(c.updated_at) });
  const bookWork = b => ({ kind: "book", id: String(b.id), title: b.title || "Nomsiz", author: b.author || "Noma'lum", genre: b.genre || "—",
    hidden: b.status === "hidden", hiddenReason: b.hidden_reason || "", lock: lockOf(b), createdAt: fmt(b.created_at),
    chapters: (b.chapters || []).filter(c => c.status !== "draft").map(chView) });
  const poemWork = p => ({ kind: "poem", id: String(p.id), title: p.title || "Nomsiz", author: p.author || "Noma'lum", genre: "She'r · " + (p.genre || "POETRY"),
    hidden: !!p.hidden, hiddenReason: p.hidden_reason || "", lock: lockOf(p), createdAt: fmt(p.created_at),
    chapters: p.status === "draft" ? [] : [chView({ id: p.id, title: p.title, content: p.content, is_premium: false, status: p.status, edited: p.edited,
      editor_note: p.editor_note, submitted_at: p.submitted_at, created_at: p.created_at, updated_at: p.updated_at })] });

  /* ---------- o'qish ---------- */
  async function load() {
    const d = await api("/editorial/works/?scope=all");
    BOOKS = (d.books || []).map(bookWork);
    POEMS = (d.poems || []).map(poemWork);
  }
  /* Sahifani ishga tushirish: kirishni tekshiradi, ma'lumotni yuklaydi, keyin run() ni chaqiradi. */
  async function boot(run) {
    if (!getSession()) { location.replace("login.html"); return; }
    try { await load(); } catch (e) {
      Admin.page({ title: "Ma'lumotni yuklab bo'lmadi", sub: (e && e.message) || "Server bilan aloqa yo'q. Backend ishlayotganini tekshiring.", sections: [] });
      return;
    }
    run();
  }
  const works = () => [...BOOKS, ...POEMS].filter(w => w.chapters.length);
  const get = (kind, id) => (kind === "poem" ? POEMS : BOOKS).find(w => w.id === String(id)) || null;
  function summary(w) {
    const n = s => w.chapters.filter(x => x.status === s).length;
    const sent = w.chapters.reduce((m, x) => x.submittedAt > m ? x.submittedAt : m, "");
    return { total: w.chapters.length, live: n("published"), queue: n("submitted") + n("editing"), returned: n("returned"),
      key: w.hidden ? "hidden" : n("submitted") ? "submitted" : n("editing") ? "editing" : n("returned") ? "returned" : "published", sent: sent || w.createdAt };
  }

  /* ---------- yozish (API) ---------- */
  const post = (path, body) => api(path, { method: "POST", body });
  const workAct = (kind, id, body) => post("/editorial/" + (kind === "poem" ? "poems" : "books") + "/" + id + "/action/", body);
  const chAct = (kind, id, chId, body) => kind === "poem" ? workAct("poem", id, body) : post("/editorial/chapters/" + chId + "/action/", body);
  const then = async fn => { const r = await fn(); await load(); return r; };

  const claim = (kind, id) => then(() => workAct(kind, id, { action: "claim" }));
  const release = (kind, id) => then(() => workAct(kind, id, { action: "release" }));
  /* she'rda alohida "boshlash" yo'q: "olib qo'yish" o'zi she'rni tahrirga o'tkazadi */
  const startChapter = (kind, id, chId) => kind === "poem" ? Promise.resolve() : then(() => chAct(kind, id, chId, { action: "start" }));
  const publish = (kind, id, chId) => then(() => chAct(kind, id, chId, { action: "publish" }));
  const publishMany = (kind, id, chIds) => then(async () => { for (const c of chIds) await chAct(kind, id, c, { action: "publish" }); });
  const unpublish = (kind, id, chId) => then(() => chAct(kind, id, chId, { action: "unpublish" }));
  const giveBack = (kind, id, chId, note) => then(() => chAct(kind, id, chId, { action: "return", note }));
  const setHidden = (kind, id, flag, reason) => then(() => workAct(kind, id, flag ? { action: "hide", reason } : { action: "unhide" }));
  /* Matnni saqlash: butun ro'yxatni qayta yuklamaymiz, faqat shu bobni yangilaymiz. */
  async function saveChapter(kind, id, chId, p) {
    const body = kind === "poem" ? { action: "edit", title: p.title, content: p.content, edited: !!p.edited }
      : { action: "edit", title: p.title, content: p.content, is_premium: !!p.isPremium, edited: !!p.edited };
    const res = await chAct(kind, id, chId, body);
    const w = get(kind, id), c = w && w.chapters.find(x => x.id === String(chId));
    if (c) {
      c.title = p.title; c.content = p.content; c.updatedAt = fmt(res && res.updated_at) || c.updatedAt;
      if (kind === "book") c.isPremium = !!p.isPremium;
      if (p.edited) c.edited = true;
    }
    return res;
  }

  /* ---------- umumiy amallar (dialoglar bilan) ---------- */
  const fail = e => alert((e && e.message) || "Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  async function startEdit(kind, id, after) {
    const w = get(kind, id);
    if (w && w.lock && !isMine(w) && !isDirector()) { alert("Bu asarni " + w.lock.by + " tahrirlayapti."); return; }
    try { await claim(kind, id); Admin.done("Tahrirga olindi: " + w.title); after(); } catch (e) { fail(e); }
  }
  async function stopEdit(kind, id, after) {
    const w = get(kind, id);
    try { await release(kind, id); Admin.done("Qo'yib yuborildi: " + w.title); after(); } catch (e) { fail(e); }
  }
  function askPublish(kind, id, chId, after) {
    const w = get(kind, id), c = w.chapters.find(x => x.id === String(chId));
    Admin.dialog({ title: "Saytga chiqarish", text: "«" + c.title + "» (" + w.title + ") saytda o'quvchilarga ko'rinadi." + (c.edited ? "" : " Diqqat: bu matn tahrirlangan deb belgilanmagan."),
      ok: "Saytga chiqarish", onOk: async () => { try { await publish(kind, id, chId); Admin.done("Saytga chiqarildi: " + w.title + " — " + c.title); after(); } catch (e) { fail(e); } } });
  }
  function askGiveBack(kind, id, chId, after) {
    const w = get(kind, id), c = w.chapters.find(x => x.id === String(chId));
    Admin.dialog({ title: "Yozuvchiga qaytarish", text: "«" + c.title + "» yozuvchiga izoh bilan qaytariladi.", fields: [{ label: "Izoh (nima tuzatilishi kerak)", multiline: true, required: true }],
      ok: "Qaytarish", danger: true, onOk: async v => { try { await giveBack(kind, id, chId, v[0]); Admin.done("Yozuvchiga qaytarildi: " + w.title + " — " + c.title + " (" + v[0] + ")"); after(); } catch (e) { fail(e); } } });
  }
  function askUnpublish(kind, id, chId, after) {
    const w = get(kind, id), c = w.chapters.find(x => x.id === String(chId));
    Admin.dialog({ title: "Tahrirga qaytarish", text: "«" + c.title + "» saytdan olib tashlanadi va qayta tahrirlanadi.", ok: "Saytdan olish", danger: true,
      onOk: async () => { try { await unpublish(kind, id, chId); Admin.done("Saytdan olindi: " + w.title + " — " + c.title); after(); } catch (e) { fail(e); } } });
  }
  function askHide(kind, id, after) {
    const w = get(kind, id);
    Admin.dialog({ title: "Asarni yashirish", text: "«" + w.title + "» o'quvchilarga ko'rinmaydi.", fields: [{ label: "Sabab (qoida buzilishi)", multiline: true, required: true }],
      ok: "Yashirish", danger: true, onOk: async v => { try { await setHidden(kind, id, true, v[0]); Admin.done("Asar yashirildi: " + w.title + " (" + v[0] + ")"); after(); } catch (e) { fail(e); } } });
  }
  async function unhide(kind, id, after) {
    const w = get(kind, id);
    try { await setHidden(kind, id, false); Admin.done("Asar qayta ko'rsatildi: " + w.title); after(); } catch (e) { fail(e); }
  }
  async function publishReady(kind, id, chIds, after) {
    const w = get(kind, id);
    try { await publishMany(kind, id, chIds); Admin.done("Saytga chiqarildi: " + w.title + " (" + chIds.length + " ta bob)"); after(); } catch (e) { fail(e); }
  }

  return { load, boot, works, get, summary, claim, release, startChapter, publish, publishMany, unpublish, giveBack, setHidden, saveChapter,
    session, startEdit, stopEdit, askPublish, askGiveBack, askUnpublish, askHide, unhide, publishReady, me, meId, isMine, isDirector, words, safeHtml, toHtml, badge, LABEL, SHORT, fail };
})();