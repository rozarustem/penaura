/**
 * ============================================================
 *  Penaura — Fiction Page Controller (js/fiction.js)
 *  Storage.js orqali faqat Fiction/Nasr asarlarini dinamik
 *  chiqarish, subgenre bo'yicha filtrlash va saralash.
 * ============================================================
 */

(function() {
  let activeSubgenre = 'all';
  let activeSort = 'popular';
  let BOOKS = [];
  let SAVED = new Set(); // saqlangan kitoblar slug'lari

  const BOOKMARK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="20 21 12 14 4 21 4 3 20 3 20 21"></polygon></svg>';

  /* Tizimga kirgan foydalanuvchining saqlagan kitoblari (kartochkadagi bookmark holati uchun). */
  async function loadSaved() {
    SAVED = new Set();
    if (!PenauraApi.getAccessToken()) return;
    try {
      const data = await PenauraApi.request('/saved/');
      SAVED = new Set((data.books || []).map(b => b.slug));
    } catch (error) { /* server yo'q yoki sessiya tugagan: hammasi "saqlanmagan" ko'rinadi */ }
  }

  async function toggleBookmark(button) {
    if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }
    const slug = button.dataset.slug;
    button.disabled = true;
    try {
      const result = await PenauraApi.request('/books/' + encodeURIComponent(slug) + '/bookmark/', { method: 'POST' });
      if (result.saved) SAVED.add(slug); else SAVED.delete(slug);
      button.classList.toggle('is-saved', !!result.saved);
      button.setAttribute('aria-pressed', String(!!result.saved));
      button.title = result.saved ? 'Saqlanganlardan olib tashlash' : 'Saqlash';
    } catch (error) {
      alert(error.message || 'Saqlab bo\'lmadi.');
    } finally {
      button.disabled = false;
    }
  }

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

  function normalizeBook(book) {
    return {
      id: book.id, slug: book.slug, title: book.title,
      author_id: book.author && book.author.id, author_name: book.author && book.author.full_name,
      genre: book.genre, subgenre: book.subgenre, tags: Array.isArray(book.tags) ? book.tags : [],
      views: book.views || 0, rating: Number(book.rating) || 0, createdAt: book.created_at || '', cover: book.cover,
    };
  }

  async function loadBooks() {
    const grid = document.querySelector('.catalog-grid');
    if (grid) grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--espresso-soft, #4A3226);">Yuklanmoqda…</p>';
    try {
      BOOKS = (await fetchAll('/books/?ordering=-created_at')).filter(b => b.status === 'published').map(normalizeBook);
    } catch (error) {
      if (grid) grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--terracotta, #B5622E);">${PenauraDOM.escapeHtml((error && error.message) || 'Kitoblarni yuklab bo\'lmadi.')}</p>`;
      return;
    }
    await loadSaved();
    renderFiction();
  }

  function formatCount(num) {
    if (!num) return '0';
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    }
    return num.toString();
  }

  function getFictionBooks() {
    let allBooks = BOOKS;

    // 1. Faqat Fiction / Hikoyalar / Romanlar / Fantastika / Detektiv
    let fictionBooks = allBooks.filter(b => {
      const g = (b.genre || '').toLowerCase();
      const sg = (b.subgenre || '').toLowerCase();
      return !g.includes('poetry') && !g.includes("she'r") && !sg.includes("she'r");
    });

    // 2. Subgenre bo'yicha filter
    if (activeSubgenre && activeSubgenre !== 'all') {
      const sub = activeSubgenre.toLowerCase();
      fictionBooks = fictionBooks.filter(b => {
        const bg = (b.genre || '').toLowerCase();
        const bsg = (b.subgenre || '').toLowerCase();
        const tags = (b.tags || []).map(tag => String(tag).toLowerCase());

        if (sub === 'lit' || sub === 'literary') return bg.includes('literary') || bsg.includes('literary') || tags.some(t => t.includes('literary') || t.includes('falsafa'));
        if (sub === 'his' || sub === 'historical') return bg.includes('historical') || bsg.includes('historical') || bg.includes('tarix') || bsg.includes('tarix') || tags.some(t => t.includes('tarix'));
        if (sub === 'rom' || sub === 'romance') return bg.includes('romance') || bsg.includes('romance') || tags.some(t => t.includes('sevgi') || t.includes('romance'));
        if (sub === 'mys' || sub === 'mystery') return bg.includes('mystery') || bsg.includes('mystery') || bg.includes('detektiv') || bsg.includes('detektiv') || tags.some(t => t.includes('detektiv') || t.includes('mystery'));
        if (sub === 'sci' || sub === 'sci-fi') return bg.includes('sci-fi') || bsg.includes('sci-fi') || bg.includes('fantastika') || bsg.includes('fantastika') || tags.some(t => t.includes('fantastika') || t.includes('sci-fi'));
        if (sub === 'fan' || sub === 'fantasy') return bg.includes('fantasy') || bsg.includes('fantasy') || tags.some(t => t.includes('fantasy'));
        if (sub === 'thr' || sub === 'thriller') return bg.includes('thriller') || bsg.includes('thriller') || tags.some(t => t.includes('thriller'));
        if (sub === 'adv' || sub === 'adventure') return bg.includes('adventure') || bsg.includes('adventure') || tags.some(t => t.includes('sarguzasht') || t.includes('adventure'));

        return bg.includes(sub) || bsg.includes(sub) || tags.some(t => t.includes(sub));
      });
    }

    // 3. Saralash
    if (activeSort === 'popular' || activeSort.includes('Popular')) {
      fictionBooks.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (activeSort === 'newest' || activeSort.includes('Newest')) {
      fictionBooks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } else if (activeSort === 'rated' || activeSort.includes('Rated')) {
      fictionBooks.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (activeSort === 'read' || activeSort.includes('Read')) {
      fictionBooks.sort((a, b) => (b.views || 0) - (a.views || 0));
    }

    return fictionBooks;
  }

  function renderFiction() {
    const grid = document.querySelector('.catalog-grid');
    const counter = document.querySelector('.discover-toolbar span');
    if (!grid) return;

    const books = getFictionBooks();

    if (counter) {
      counter.textContent = `Showing 1–${books.length} of ${books.length} fiction stories`;
    }

    if (books.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--espresso-soft, #4A3226);">
          <div style="font-size: 2.5rem; margin-bottom: 0.8rem; opacity: 0.6;">📚</div>
          <h3 style="font-family: var(--font-display, serif); font-size: 1.3rem; margin-bottom: 0.4rem;">Bu janrda hali asar yo'q</h3>
          <p style="font-size: 0.9rem; max-width: 400px; margin: 0 auto 1.5rem;">Birinchi bo'lib hikoya yoki roman yozing va nashr eting!</p>
          <a href="upload.html" style="display: inline-block; text-decoration: none; padding: 0.6rem 1.4rem; background: var(--terracotta, #B5622E); color: #FAF8F4; border-radius: var(--radius, 4px); font-family: var(--font-mono, monospace); font-size: 0.85rem;">+ Start Writing</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = books.map(book => {
      const authorName = book.author_name || 'Muallif';
      const genre = (book.subgenre || book.genre || 'FICTION').toUpperCase();
      const safeTitle = PenauraDOM.escapeHtml(book.title);
      const safeAuthor = PenauraDOM.escapeHtml(authorName);
      const safeGenre = PenauraDOM.escapeHtml(genre);
      const viewsFormatted = formatCount(book.views || 0);
      const rating = book.rating > 0 ? book.rating.toFixed(1) : '—';
      const coverUrl = PenauraDOM.getSafeImageUrl(book.cover);

      let coverHtml = 'cover';
      if (coverUrl) {
        coverHtml = `<img src="${PenauraDOM.escapeHtml(coverUrl)}" alt="${safeTitle}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`;
      } else {
        coverHtml = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; padding:1rem; text-align:center;">
          <span style="font-family:var(--font-display, serif); font-weight:700; font-size:1.05rem; line-height:1.2; color:var(--espresso, #2C1810);">${safeTitle}</span>
          <span style="font-family:var(--font-mono, monospace); font-size:0.75rem; color:var(--terracotta, #B5622E); margin-top:0.4rem;">${safeAuthor}</span>
        </div>`;
      }

      const slug = book.slug || String(book.id);
      const isSaved = SAVED.has(slug);
      return `
        <div class="work-item">
          <a class="work-card" href="book.html?book=${encodeURIComponent(slug)}" style="transition: transform 0.15s ease, box-shadow 0.15s ease;">
            <div class="ph" style="overflow:hidden; position:relative;">${coverHtml}</div>
            <div class="genre">${safeGenre}</div>
            <h3>${safeTitle}</h3>
            <div class="author">${safeAuthor}</div>
            <div class="meta">★ ${rating} · ${viewsFormatted} reads</div>
          </a>
          <button type="button" class="card-bookmark${isSaved ? ' is-saved' : ''}" data-slug="${PenauraDOM.escapeHtml(slug)}"
                  aria-pressed="${isSaved}" aria-label="Saqlash" title="${isSaved ? 'Saqlanganlardan olib tashlash' : 'Saqlash'}">${BOOKMARK_SVG}</button>
        </div>
      `;
    }).join('');
  }

  function initSubgenres() {
    const params = new URLSearchParams(window.location.search);
    const subParam = params.get('sub') || params.get('genre');
    if (subParam) activeSubgenre = subParam;

    const items = document.querySelectorAll('.subgenre-strip .subgenre-item');
    items.forEach(item => {
      const nameEl = item.querySelector('.name');
      const nameText = nameEl ? nameEl.textContent.trim().toLowerCase() : '';

      if (activeSubgenre !== 'all' && (nameText === activeSubgenre || nameText.includes(activeSubgenre))) {
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }

      item.style.cursor = 'pointer';
      item.addEventListener('click', function() {
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const text = nameEl ? nameEl.textContent.trim().toLowerCase() : 'all';
        activeSubgenre = text === 'all' ? 'all' : text;
        renderFiction();
      });
    });

    const sortSelect = document.querySelector('.sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', function(e) {
        activeSort = e.target.value.toLowerCase();
        renderFiction();
      });
    }

    const grid = document.querySelector('.catalog-grid');
    if (grid) {
      grid.addEventListener('click', event => {
        const button = event.target.closest('.card-bookmark');
        if (!button) return;
        event.preventDefault();
        toggleBookmark(button);
      });
    }

    loadBooks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSubgenres);
  } else {
    initSubgenres();
  }
})();