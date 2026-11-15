/* Admin sahifalari uchun umumiy qismlar: statistika, jadval (qidiruv + sahifalash),
   yoqish/o'chirish tugmalari, sozlamalar, dialog va "Nashr qilish" paneli.
   Har bir sahifa Admin.page({...}) ni chaqiradi. */
const Admin = (() => {
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
  const changes = new Map(), savers = new Map(), commits = [], saveBtns = [];
  let session, bar, barText;

  /* Audit jurnali endi serverda yoziladi (backend o'zi saqlaydi), brauzerda emas. */
  function log() {}
  function toast(m) { const t = el("div", "toast", m); t.setAttribute("role", "status"); document.body.append(t); setTimeout(() => t.remove(), 2600); }
  function done(text) { log(text); toast(text); }
  /* saver — "Nashr qilish" bosilganda serverga yozadigan funksiya (ixtiyoriy) */
  function change(key, text, same, saver) {
    if (same) { changes.delete(key); savers.delete(key); } else { changes.set(key, text); if (saver) savers.set(key, saver); }
    bar.hidden = !changes.size; barText.textContent = changes.size + " ta saqlanmagan o'zgarish"; saveBtns.forEach(b => { b.disabled = !changes.size; });
  }
  const B = (t, k) => ({ badge: [t, k] });

  function dialog(o) {
    const d = el("dialog", "dlg"), f = el("form");
    f.append(el("h2", null, o.title));
    if (o.text) f.append(el("p", "sub", o.text));
    if (o.list) { const ul = el("ul", "dlg-list"); o.list.forEach(x => ul.append(el("li", null, x))); f.append(ul); }
    const inputs = (o.fields || []).map(x => {
      const l = el("label", "field", x.label), i = el(x.options ? "select" : x.multiline ? "textarea" : "input");
      if (x.options) x.options.forEach(([v, t]) => { const op = el("option", null, t); op.value = v; i.append(op); });
      i.value = x.value || ""; i.required = !!x.required; l.append(i); f.append(l); return i;
    });
    const act = el("div", "dlg-actions"), c = el("button", "btn", "Bekor qilish"), ok = el("button", "btn " + (o.danger ? "btn-danger" : "btn-primary"), o.ok || "Saqlash");
    c.type = "button"; c.addEventListener("click", () => d.close()); ok.type = "submit";
    act.append(c, ok); f.append(act); d.append(f); document.body.append(d);
    f.addEventListener("submit", e => { e.preventDefault(); if (o.onOk) o.onOk(inputs.map(i => i.value.trim())); d.close(); });
    d.addEventListener("close", () => d.remove()); d.showModal();
  }

  function cell(td, v, row, draw) {
    if (typeof v === "function") v = v(row);
    if (v && typeof v === "object") {
      if (v.badge) td.append(el("span", "badge b-" + v.badge[1], v.badge[0]));
      else if (v.toggle !== undefined) {
        const l = el("label", "sw"), i = el("input"), s = el("span");
        i.type = "checkbox"; i.checked = v.toggle; i.disabled = !!v.disabled; i.setAttribute("aria-label", v.what);
        v.base = v.toggle;
        i.addEventListener("change", () => { v.toggle = i.checked; change(v.what, v.what + (i.checked ? " yoqildi" : " o'chirildi"), i.checked === v.base, v.save ? () => v.save(v.toggle) : null); });
        commits.push(() => { v.base = v.toggle; });
        l.append(i, s); td.append(l);
      } else if (v.btns) v.btns.forEach(b => {
        const x = el("button", "btn btn-sm" + (b.kind ? " btn-" + b.kind : ""), b.text);
        x.type = "button"; x.addEventListener("click", () => b.fn(row, draw)); td.append(x);
      });
      else td.textContent = v.text;
    } else {
      td.textContent = v;
      if (/^\+/.test(v)) td.classList.add("pos"); else if (/^−/.test(v)) td.classList.add("neg");
    }
  }

  function table(sec) {
    const box = el("section", "card"), tb = el("div", "toolbar"), tools = el("div", "tools");
    tb.append(el("h2", null, sec.title), tools);
    let q = "", page = 0; const size = sec.size || 8;
    if (sec.search) {
      const s = el("input", "search"); s.type = "search"; s.placeholder = "Qidirish..."; s.setAttribute("aria-label", "Qidirish");
      s.addEventListener("input", () => { q = s.value.trim().toLowerCase(); page = 0; draw(); }); tools.append(s);
    }
    if (sec.add) {
      const b = el("button", "btn btn-primary", sec.add.text); b.type = "button";
      b.addEventListener("click", () => dialog({
        title: sec.add.text, ok: "Qo'shish", fields: sec.add.fields.map(f => ({ ...f, required: true })),
        onOk: v => { sec.rows.push(sec.add.make(v)); change("add:" + v[0], sec.add.text + ": " + v[0], false); draw(); }
      }));
      tools.append(b);
    }
    const wrap = el("div", "table-wrap"), t = el("table"), th = el("thead"), hr = el("tr"), body = el("tbody"), pager = el("div", "pager");
    sec.cols.forEach(c => hr.append(el("th", null, c.h || c)));
    th.append(hr); t.append(th, body); wrap.append(t); box.append(tb, wrap, pager);
    const text = r => r.map(c => { if (typeof c === "function") c = c(r); return c && typeof c === "object" ? (c.badge ? c.badge[0] : c.text || "") : String(c); }).join(" ").toLowerCase();
    function draw() {
      const rows = sec.rows.filter(r => !q || text(r).includes(q));
      const pages = Math.max(1, Math.ceil(rows.length / size)); if (page >= pages) page = pages - 1;
      body.replaceChildren();
      if (!rows.length) { const td = el("td", null, "Hech narsa topilmadi. Qidiruv so'zini o'zgartiring."), er = el("tr"); td.colSpan = sec.cols.length; er.append(td); body.append(er); }
      rows.slice(page * size, page * size + size).forEach(r => {
        const tr = el("tr");
        r.forEach((v, i) => { const td = el("td"); if (sec.cols[i].mono) td.classList.add("mono"); cell(td, v, r, draw); tr.append(td); });
        if (sec.onRow) { tr.className = "row-link"; tr.addEventListener("click", e => { if (!e.target.closest("button,a,label,input")) sec.onRow(r); }); }
        body.append(tr);
      });
      const from = rows.length ? page * size + 1 : 0;
      pager.replaceChildren(el("span", null, "Ko'rsatilmoqda " + from + "–" + Math.min(rows.length, page * size + size) + " / " + rows.length));
      if (pages > 1) {
        const nav = el("div");
        [["‹ Oldingi", -1], ["Keyingi ›", 1]].forEach(([x, d]) => {
          const b = el("button", "btn btn-sm", x); b.type = "button"; b.disabled = page + d < 0 || page + d >= pages;
          b.addEventListener("click", () => { page += d; draw(); }); nav.append(b);
        });
        pager.append(nav);
      }
    }
    sec.redraw = draw; draw(); return box;
  }

  function kv(sec) {
    const box = el("section", "card"); box.append(el("h2", null, sec.title));
    sec.rows.forEach(([l, v]) => { const r = el("div", "kv"); r.append(el("span", null, l), el("span", null, v)); box.append(r); });
    return box;
  }

  async function publishChanges() {
    const n = changes.size; if (!n) return;
    for (const [key, save] of [...savers]) {
      try { await save(); savers.delete(key); }
      catch (e) { toast("Saqlab bo'lmadi: " + ((e && e.message) || key)); return; }
    }
    changes.forEach(t => log(t)); commits.forEach(c => c());
    changes.clear(); bar.hidden = true; saveBtns.forEach(b => { b.disabled = true; });
    toast(n + " ta o'zgarish saqlandi");
  }

  function stats(items) {
    const g = el("section", "stats");
    items.forEach(([l, v, n, tone]) => {
      const c = el("div", "card stat"); c.append(el("div", "sub", l), el("div", "stat-v", v));
      if (n) c.append(el("div", "stat-n " + (tone || ""), n)); g.append(c);
    });
    return g;
  }

  function settings(sec, ro) {
    const box = el("section", "card"); box.append(el("h2", null, sec.title));
    if (ro) box.append(el("p", "note", "Bu qiymatlarni faqat direktor o'zgartira oladi."));
    const ins = new Map();
    sec.fields.forEach(f => {
      const row = el("div", "setrow"), l = el("div"), w = el("div"), i = el("input"); ins.set(f, i);
      l.append(el("strong", null, f.label), el("small", null, f.hint));
      i.value = f.value; i.disabled = ro; i.setAttribute("aria-label", f.label);
      i.addEventListener("input", () => change(f.label, f.label + ": " + f.value + " → " + i.value, i.value === f.value));
      commits.push(() => { f.value = i.value; });
      w.append(i); row.append(l, w); box.append(row);
    });
    if (!ro) {
      const err = el("p", "err"), act = el("div", "dlg-actions"), save = el("button", "btn btn-primary", "Saqlash");
      save.type = "button"; save.disabled = !changes.size; saveBtns.push(save);
      save.addEventListener("click", () => {
        const bad = sec.fields.find(f => { if (!f.num) return false; const v = ins.get(f).value.trim(); return !(/^\d+$/.test(v) && +v >= (f.min || 0) && (f.max === undefined || +v <= f.max)); });
        if (bad) { err.textContent = bad.label + ": butun son kiriting" + (bad.min ? " (" + bad.min + " dan kam emas)" : "") + (bad.max !== undefined ? " (0–" + bad.max + ")" : "") + "."; ins.get(bad).focus(); return; }
        err.textContent = "";
        dialog({ title: "O'zgarishlarni saqlash", text: "Quyidagi o'zgarishlar kuchga kiradi:", list: [...changes.values()], ok: "Saqlash", onOk: publishChanges });
      });
      act.append(save); box.append(err, act);
    }
    return box;
  }

  /* Admin.page ishlatmaydigan maxsus sahifalar (masalan, bob muharriri) uchun: kirish tekshiruvi + sidebar. */
  function start() { session = requireAccess(); if (session) { renderSidebar(session); verifySession(); } return session; }

  function page(cfg) {
    session = requireAccess(); if (!session) return;
    renderSidebar(session); verifySession(); document.title = cfg.title + " — Penaura";
    const main = document.getElementById("main"), head = el("div", "page-head"), h = el("div");
    if (cfg.back) { const a = el("a", "back", "← " + cfg.back[0]); a.href = cfg.back[1]; h.append(a); }
    h.append(el("h1", null, cfg.title), el("p", "sub", cfg.sub)); head.append(h);
    if (cfg.actions) { const ac = el("div", "tools"); cfg.actions.forEach(b => { const x = el("button", "btn" + (b.kind ? " btn-" + b.kind : ""), b.text); x.type = "button"; x.addEventListener("click", b.fn); ac.append(x); }); head.append(ac); }
    main.append(head);
    bar = el("div", "dirty"); bar.hidden = true; barText = el("span");
    const cancel = el("button", "btn btn-sm", "Bekor qilish"), pub = el("button", "btn btn-sm btn-primary", "Nashr qilish");
    cancel.type = pub.type = "button";
    cancel.addEventListener("click", () => location.reload());
    pub.addEventListener("click", publishChanges);
    bar.append(barText, cancel, pub); document.body.append(bar);
    (typeof cfg.sections === "function" ? cfg.sections(session) : cfg.sections).forEach(s =>
      main.append(s.type === "stats" ? stats(s.items) : s.type === "table" ? table(s) : s.type === "kv" ? kv(s) : settings(s, session.role !== "direktor")));
  }
  return { page, start, dialog, done, log, change, B };
})();