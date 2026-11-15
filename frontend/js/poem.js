/**
 * ============================================================
 *  Penaura — Poetry Page Controller (js/poem.js)
 *  She'riyat sahifasi backend (API) bilan ishlaydi:
 *   • Nashr qilingan she'rlar /poems/ dan olinadi (mavzu bo'yicha filter, saralash)
 *   • she'r ochilganda ko'rishlar soni oshadi
 *   • poem.html?poem=<slug> — shu she'rni ochilgan holda ko'rsatadi
 *  Yulduzcha bilan baholash va "Bookmark" serverda saqlanadi (tizimga kirgan foydalanuvchi uchun):
 *    GET /poems/activity/, PUT|DELETE /poems/<slug>/rating/, POST /poems/<slug>/bookmark/
 * ============================================================
 */
(function () {
  const esc = value => PenauraDOM.escapeHtml(value);
  let activeTopic = 'all';
  let activeSort = 'popular';
  let POEMS = [];
  const counted = new Set();

  /* Barcha sahifalarni (20 tadan) yuklab, bitta ro'yxatga yig'adi. */
  async function fetchAll(path) {
    const out = [];
    let next = path;
    for (let page = 0; next && page < 25; page++) {
      const data = await PenauraApi.request(next, { public: true });
      if (Array.isArray(data)) return data;
      out.push(...(data.results || []));
      next = data.next ? data.next.replace(/^https?:\/\/[^/]+\/api/, '') : null;
    }
    return out;
  }

  /* Matn HTML bo'lsa (tahrirchi muharriridan), oddiy qatorlarga aylantiradi. */
  function toPlainText(content) {
    const text = String(content || '');
    if (!/<[a-z][\s\S]*>/i.test(text)) return text.trim();
    const html = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    return (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim();
  }

  function normalizePoem(poem) {
    const full = toPlainText(poem.content);
    const excerpt = toPlainText(poem.excerpt) || full.split('\n').filter(line => line.trim()).slice(0, 2).join('\n');
    return {
      id: String(poem.id), slug: poem.slug, title: poem.title,
      author: (poem.author && poem.author.full_name) || 'Muallif',
      topic: String(poem.topic || '').toLowerCase(), genre: String(poem.topic || poem.genre || 'POETRY').toUpperCase(),
      excerpt, fullText: full, views: poem.views || 0, rating: Number(poem.rating) || 0, createdAt: poem.created_at || '',
    };
  }

  /* ---------- Foydalanuvchi faolligi: baho va Bookmark (serverda saqlanadi) ---------- */
  let myRatings = {};           // { poemId: 1..5 }
  let myBookmarks = new Set();  // Set<poemId>
  const isLoggedIn = () => !!PenauraApi.getAccessToken();
  const poemUrl = (poem, part) => '/poems/' + encodeURIComponent(poem.slug) + '/' + part + '/';

  function requireLogin() {
    alert("Baholash va saqlash uchun avval tizimga kiring.");
    window.location.href = 'signin.html';
  }

  async function loadActivity() {
    myRatings = {};
    myBookmarks = new Set();
    if (!isLoggedIn()) return;
    try {
      const data = await PenauraApi.request('/poems/activity/');
      Object.entries(data.ratings || {}).forEach(([id, value]) => { myRatings[id] = Number(value); });
      myBookmarks = new Set((data.bookmarks || []).map(String));
    } catch (error) { /* server yo'q yoki sessiya tugagan: baho va bookmark bo'sh ko'rsatiladi */ }
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || fallback); } catch (e) { return JSON.parse(fallback); }
  }

  /* Eski versiyada baho va Bookmark brauzerda (localStorage) saqlangan edi.
     Tizimga kirgan foydalanuvchi uchun ularni bir marta serverga ko'chiramiz, keyin brauzerdan o'chiramiz. */
  async function migrateLocalActivity() {
    if (!isLoggedIn()) return;
    const oldRatings = readJson('penaura_poem_ratings', '{}');
    const oldBookmarks = readJson('penaura_poem_bookmarks', '[]');
    const jobs = [];
    const byId = new Map(POEMS.map(poem => [poem.id, poem]));

    Object.entries(oldRatings).forEach(([id, value]) => {
      const poem = byId.get(String(id));
      const stars = Number(value);
      if (!poem || myRatings[id] || !(stars >= 1 && stars <= 5)) return;
      jobs.push(PenauraApi.request(poemUrl(poem, 'rating'), { method: 'PUT', body: { value: stars } })
        .then(() => { myRatings[id] = stars; }));
    });
    (Array.isArray(oldBookmarks) ? oldBookmarks : []).forEach(rawId => {
      const id = String(rawId);
      const poem = byId.get(id);
      if (!poem || myBookmarks.has(id)) return;
      jobs.push(PenauraApi.request(poemUrl(poem, 'bookmark'), { method: 'POST' })
        .then(() => { myBookmarks.add(id); }));
    });

    const results = await Promise.allSettled(jobs);
    // Server bilan aloqa uzilgan bo'lsa, eski ma'lumotni saqlab qolamiz va keyingi safar qayta urinamiz
    const networkFailure = results.some(r => r.status === 'rejected' && !(r.reason && r.reason.status));
    if (!networkFailure) {
      localStorage.removeItem('penaura_poem_ratings');
      localStorage.removeItem('penaura_poem_bookmarks');
    }
  }

  function paintStars(poemId) {
    const container = document.querySelector(`.rate-btn[data-id="${poemId}"]`);
    if (!container) return;
    const value = myRatings[poemId] || 0;
    container.querySelectorAll('[data-star]').forEach((star, index) => {
      star.classList.toggle('filled', index < value);
      star.setAttribute('aria-pressed', String(index + 1 === value));
    });
  }

  async function setRating(poemId, value) {
    const poem = POEMS.find(p => p.id === poemId);
    if (!poem) return;
    if (!isLoggedIn()) { requireLogin(); return; }
    const previous = myRatings[poemId] || 0;
    const next = previous === value ? 0 : value; // o'sha yulduzni qayta bossa, baho olib tashlanadi
    myRatings[poemId] = next;
    paintStars(poemId);
    try {
      const result = next
        ? await PenauraApi.request(poemUrl(poem, 'rating'), { method: 'PUT', body: { value: next } })
        : await PenauraApi.request(poemUrl(poem, 'rating'), { method: 'DELETE' });
      poem.rating = Number(result.rating) || 0; // "Top rated" saralash yangi o'rtachaga qarab ishlaydi
    } catch (error) {
      myRatings[poemId] = previous;
      paintStars(poemId);
      alert(error.message || "Bahoni saqlab bo'lmadi.");
    }
  }

  async function toggleBookmark(poemId, button) {
    const poem = POEMS.find(p => p.id === poemId);
    if (!poem) return;
    if (!isLoggedIn()) { requireLogin(); return; }
    try {
      const result = await PenauraApi.request(poemUrl(poem, 'bookmark'), { method: 'POST' });
      if (result.bookmarked) myBookmarks.add(poemId); else myBookmarks.delete(poemId);
      if (button) {
        button.classList.toggle('is-saved', result.bookmarked);
        button.setAttribute('aria-pressed', String(result.bookmarked));
        button.textContent = result.bookmarked ? '★ Saved' : '☆ Bookmark';
      }
    } catch (error) {
      alert(error.message || "Saqlab bo'lmadi.");
    }
  }

  /* ---------- Chiqarish ---------- */
  function renderPoems(openSlug) {
    const grid = document.querySelector('.poem-grid');
    const counter = document.querySelector('.discover-toolbar span');
    if (!grid) return;

    let poems = [...POEMS];
    if (activeTopic && activeTopic !== 'all') poems = poems.filter(p => p.topic === activeTopic.toLowerCase());

    const sort = String(activeSort).toLowerCase();
    if (sort.includes('popular') || sort.includes('read')) poems.sort((a, b) => b.views - a.views);
    else if (sort.includes('rated')) poems.sort((a, b) => b.rating - a.rating);
    else if (sort.includes('newest')) poems.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (counter) counter.textContent = `Showing ${poems.length ? '1–' + poems.length : 0} of ${POEMS.length} poems`;

    if (!poems.length) {
      const sessionUser = window.Storage && Storage.getCurrentUser();
      const canWrite = !!(sessionUser && sessionUser.role === 'writer');
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--espresso-soft, #4A3226);">
          <div style="font-size: 2.5rem; margin-bottom: 0.8rem; opacity: 0.6;">✒️</div>
          <h3 style="font-family: var(--font-display, serif); font-size: 1.3rem; margin-bottom: 0.4rem;">${POEMS.length ? "Bu mavzuda hali she'r yo'q" : "Hozircha nashr qilingan she'rlar yo'q"}</h3>
          ${canWrite
            ? `<p style="font-size: 0.9rem; max-width: 400px; margin: 0 auto 1.5rem;">Birinchi bo'lib she'r yozing va nashr eting!</p>
          <a href="upload.html" style="display: inline-block; text-decoration: none; padding: 0.6rem 1.4rem; background: var(--terracotta, #B5622E); color: #FAF8F4; border-radius: var(--radius, 4px);">+ Upload new</a>`
            : `<p style="font-size: 0.9rem; max-width: 400px; margin: 0 auto;">Yozuvchilar tez orada she'rlarini shu yerda nashr etadi.</p>`}
        </div>`;
      return;
    }

    grid.innerHTML = poems.map(poem => {
      const currentRating = Number(myRatings[poem.id]) || 0;
      const isBookmarked = myBookmarks.has(poem.id);
      const stars = [1, 2, 3, 4, 5].map(i =>
        `<button type="button" class="${i <= currentRating ? 'filled' : ''}" data-star="${i}" aria-label="Rate ${i} out of 5" aria-pressed="${i === currentRating}">★</button>`).join('');

      return `
        <details class="poem-card" data-id="${esc(poem.id)}" data-slug="${esc(poem.slug)}"${openSlug && poem.slug === openSlug ? ' open' : ''}>
          <summary style="cursor:pointer; list-style:none;">
            <div class="genre">${esc(poem.genre)}</div>
            <div class="poem-title">${esc(poem.title)}</div>
            <div class="author">${esc(poem.author)}</div>
            <p class="excerpt">${esc(poem.excerpt).replace(/\r?\n/g, '<br>')}</p>
            <div class="expand-hint">Click to expand full poem ↓ · ${poem.views} reads</div>
          </summary>
          <div class="poem-full-text">${esc(poem.fullText).replace(/\r?\n/g, '<br>')}</div>
          <div class="meta">
            <div class="rate-btn" data-id="${esc(poem.id)}">${stars}</div>
            <button class="btn-bookmark${isBookmarked ? ' is-saved' : ''}" data-id="${esc(poem.id)}" title="Saqlash (Bookmark)" aria-pressed="${isBookmarked}">
              ${isBookmarked ? '★ Saved' : '☆ Bookmark'}
            </button>
          </div>
        </details>`;
    }).join('');

    grid.querySelectorAll('.rate-btn').forEach(container => {
      const poemId = container.getAttribute('data-id');
      const starButtons = container.querySelectorAll('[data-star]');
      starButtons.forEach(star => {
        star.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          setRating(poemId, Number(star.getAttribute('data-star')));
        });
      });
    });

    grid.querySelectorAll('.btn-bookmark').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(btn.getAttribute('data-id'), btn);
      });
    });

    // She'r birinchi marta ochilganda ko'rishlar soni oshadi (har sahifa ochilishida bir marta)
    grid.querySelectorAll('details.poem-card').forEach(card => {
      card.addEventListener('toggle', () => {
        const slug = card.getAttribute('data-slug');
        if (!card.open || counted.has(slug)) return;
        counted.add(slug);
        PenauraApi.request('/poems/' + encodeURIComponent(slug) + '/', { public: true }).catch(() => {});
      });
    });

    if (openSlug) {
      const target = grid.querySelector('details[open]');
      if (target) target.scrollIntoView({ block: 'center' });
    }
  }

  async function initPoetry() {
    const pills = document.querySelectorAll('.pills .pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeTopic = pill.textContent.trim().toLowerCase();
        renderPoems();
      });
    });

    const sortSelect = document.querySelector('.sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', e => {
        activeSort = e.target.value;
        renderPoems();
      });
    }

    const grid = document.querySelector('.poem-grid');
    if (grid) grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--espresso-soft, #4A3226);">Yuklanmoqda…</p>';

    try {
      const [allPoems] = await Promise.all([fetchAll('/poems/?ordering=-created_at'), loadActivity()]);
      POEMS = allPoems
        .filter(poem => poem.status === 'published' && !poem.is_hidden)
        .map(normalizePoem);
    } catch (error) {
      if (grid) grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--terracotta, #B5622E);">${esc((error && error.message) || "She'rlarni yuklab bo'lmadi.")}</p>`;
      return;
    }
    await migrateLocalActivity();
    renderPoems(new URLSearchParams(window.location.search).get('poem'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPoetry);
  else initPoetry();
})();