/* Audit yozuvlarini (backend: action, target_type, target_id, details) o'qiladigan matnga aylantiradi. */
const AuditFormat = (() => {
  const pad = n => String(n).padStart(2, "0");
  const when = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : ""; };
  const ROLE = { direktor: "Direktor", moliyachi: "Moliyachi", moderator: "Moderator", tahrirchi: "Tahrirchi", writer: "Yozuvchi", reader: "O'quvchi" };
  const OBJ = { book: "Kitob", chapter: "Bob", poem: "She'r", article: "Maqola", user: "Foydalanuvchi" };
  const VERB = { claim: "band qilindi", release: "bo'shatildi", publish: "nashr qilindi", return: "qaytarildi", hide: "yashirildi", unhide: "ko'rsatildi",
    unpublish: "nashrdan olindi", start: "tahrirga olindi", edit: "tahrirlandi", create: "yaratildi", update: "yangilandi", delete: "o'chirildi",
    blocked: "bloklandi", unblocked: "blokdan chiqarildi", role_changed: "roli o'zgartirildi" };
  const FIXED = { admin_login: "Admin panelga kirdi", password_reset: "Parol tiklandi", account_deleted: "Foydalanuvchi hisobini o'chirdi", wallet_credit: "Tanga qo'shildi" };

  function title(a) {
    if (FIXED[a.action]) return FIXED[a.action];
    const [obj, ...rest] = String(a.action).split("_"), verb = rest.join("_");
    return (OBJ[obj] || obj) + " " + (VERB[verb] || verb.replace(/_/g, " "));
  }
  function detail(a) {
    const d = a.details || {}, out = [];
    if (d.title) out.push("«" + d.title + "»");
    if (d.name) out.push(d.name);
    if (d.email) out.push(d.email);
    if (d.from_role && d.to_role) out.push((ROLE[d.from_role] || d.from_role) + " → " + (ROLE[d.to_role] || d.to_role));
    if (d.amount) out.push(d.amount + " tanga");
    if (d.reference) out.push("sabab: " + d.reference);
    if (d.note) out.push("izoh: " + d.note);
    if (d.book_id) out.push("kitob #" + d.book_id);
    if (!out.length && a.target_type && a.target_id) out.push("#" + a.target_id);
    return out.join(" · ");
  }
  const text = a => { const t = title(a), d = detail(a); return d ? t + " — " + d : t; };
  return { when, text, role: r => ROLE[r] || r || "—" };
})();