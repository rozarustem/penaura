/**
 * ============================================================
 *  Penaura — Saqlanganlar sahifasi (js/saved.js)
 *  Foydalanuvchi bookmark qilgan kitob va she'rlar serverdan olinadi:
 *    GET  /saved/                       — { books: [...], poems: [...] }
 *    DELETE /books/<slug>/bookmark/     — saqlanganlardan olib tashlash
 *    DELETE /poems/<slug>/bookmark/     — saqlanganlardan olib tashlash
 * ============================================================
 */
(function () {
  const esc = value => PenauraDOM.escapeHtml(value);
  const $ = id => document.getElementById(id);
  let data = { books: [], poems: [] };
  let activeTab = 'books';

  /* Instagram uslubidagi bookmark belgisi (olib tashlash tugmasi) */
  const BOOKMARK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="20 21 12 14 4 21 4 3 20 3 20 21"></polygon></svg>';
  const unsaveButton = '<button type="button" class="card-bookmark is-saved" data-action="unsave" ' +
    'aria-label="Saqlanganlardan olib tashlash" title="Saqlanganlardan olib tashlash">' + BOOKMARK_SVG + '</button>';

  function formatCount(num) {
    const n = Number(num) || 0;
    return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
  }

  /* She'r matni HTML bo'lsa (tahrirchi muharriridan), oddiy matnga aylantiradi. */
  function toPlainText(content) {
    const text = String(content || '');
    if (!/<[a-z][\s\S]*>/i.test(text)) return text.trim();
    const html = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    return (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim();
  }

  function showState(html) {
    const box = $('saved-state');
    box.innerHTML = html;
    box.hidden = !html;
  }

  /* ---------- Kartochkalar ---------- */
  function bookCard(book) {
    const author = (book.author && book.author.full_name) || 'Muallif';
    const genre = String(book.subgenre || book.genre || 'FICTION').toUpperCase();
    const coverUrl = PenauraDOM.getSafeImageUrl(book.cover);
    const rating = Number(book.rating) > 0 ? Number(book.rating).toFixed(1) : '—';
    const cover = coverUrl
      ? `<img src="${esc(coverUrl)}" alt="${esc(book.title)}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`
      : `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; padding:1rem; text-align:center;">
           <span style="font-family:var(--font-display, serif); font-weight:700; font-size:1.05rem; line-height:1.2; color:var(--espresso, #2C1810);">${esc(book.title)}</span>
           <span style="font-family:var(--font-mono, monospace); font-size:0.75rem; color:var(--terracotta, #B5622E); margin-top:0.4rem;">${esc(author)}</span>
         </div>`;
    return `
      <div class="saved-item" data-type="book" data-slug="${esc(book.slug)}">
        <a class="work-card" href="book.html?book=${encodeURIComponent(book.slug)}">
          <div class="ph" style="overflow:hidden; position:relative;">${cover}</div>
          <div class="genre">${esc(genre)}</div>
          <h3>${esc(book.title)}</h3>
          <div class="author">${esc(author)}</div>
          <div class="meta">★ ${rating} · ${formatCount(book.views)} reads</div>
        </a>
        ${unsaveButton}
      </div>`;
  }

  function poemCard(poem) {
    const full = toPlainText(poem.content);
    const excerpt = toPlainText(poem.excerpt) ||
      full.split('\n').filter(line => line.trim()).slice(0, 2).join('\n');
    const author = (poem.author && poem.author.full_name) || 'Muallif';
    return `
      <div class="saved-item" data-type="poem" data-slug="${esc(poem.slug)}">
        <details class="poem-card">
          <summary style="cursor:pointer; list-style:none;">
            <div class="genre">${esc(String(poem.topic || poem.genre || 'POETRY').toUpperCase())}</div>
            <div class="poem-title">${esc(poem.title)}</div>
            <div class="author">${esc(author)}</div>
            <p class="excerpt">${esc(excerpt).replace(/\r?\n/g, '<br>')}</p>
            <div class="expand-hint">Click to expand full poem ↓</div>
          </summary>
          <div class="poem-full-text">${esc(full).replace(/\r?\n/g, '<br>')}</div>
        </details>
        ${unsaveButton}
      </div>`;
  }

  /* ---------- Chiqarish ---------- */
  function render() {
    const total = data.books.length + data.poems.length;
    $('count-books').textContent = data.books.length;
    $('count-poems').textContent = data.poems.length;
    $('saved-tabs').hidden = total === 0;

    if (!total) {
      $('saved-books').hidden = true;
      $('saved-poems').hidden = true;
      showState(`
        <h3>Hali hech narsa saqlamagansiz</h3>
        <p>Kitob yoki she'r sahifasidagi <strong>Save</strong> / <strong>Bookmark</strong> tugmasini bossangiz, u shu yerda paydo bo'ladi.</p>
        <a class="saved-cta" href="fiction.html">Kitoblarni ko'rish →</a>`);
      return;
    }

    document.querySelectorAll('#saved-tabs .pill').forEach(pill =>
      pill.classList.toggle('active', pill.dataset.tab === activeTab));

    const list = activeTab === 'books' ? data.books : data.poems;
    $('saved-books').hidden = activeTab !== 'books' || !list.length;
    $('saved-poems').hidden = activeTab !== 'poems' || !list.length;
    $('saved-books').innerHTML = data.books.map(bookCard).join('');
    $('saved-poems').innerHTML = data.poems.map(poemCard).join('');

    showState(list.length ? '' : (activeTab === 'books'
      ? `<h3>Saqlangan kitob yo'q</h3><p>Kitob sahifasidagi Save tugmasi bilan saqlang.</p><a class="saved-cta" href="fiction.html">Kitoblarni ko'rish →</a>`
      : `<h3>Saqlangan she'r yo'q</h3><p>She'r kartochkasidagi Bookmark tugmasi bilan saqlang.</p><a class="saved-cta" href="poem.html">She'rlarni ko'rish →</a>`));
  }

  async function unsave(item) {
    const type = item.dataset.type;
    const slug = item.dataset.slug;
    const url = (type === 'book' ? '/books/' : '/poems/') + encodeURIComponent(slug) + '/bookmark/';
    try {
      await PenauraApi.request(url, { method: 'DELETE' });
      const key = type === 'book' ? 'books' : 'poems';
      data[key] = data[key].filter(entry => entry.slug !== slug);
      render();
    } catch (error) {
      alert(error.message || 'Olib tashlab bo\'lmadi.');
    }
  }

  function bindEvents() {
    document.querySelectorAll('#saved-tabs .pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeTab = pill.dataset.tab;
        history.replaceState(null, '', '#' + activeTab);
        render();
      });
    });
    ['saved-books', 'saved-poems'].forEach(id => {
      $(id).addEventListener('click', event => {
        const button = event.target.closest('[data-action="unsave"]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        unsave(button.closest('[data-slug]'));
      });
    });
  }

  async function init() {
    bindEvents();
    if (!PenauraApi.getAccessToken()) {
      showState(`
        <h3>Saqlanganlarni ko'rish uchun tizimga kiring</h3>
        <p>Saqlagan kitob va she'rlaringiz hisobingizga bog'langan.</p>
        <a class="saved-cta" href="signin.html">Sign In →</a>`);
      return;
    }
    try {
      const result = await PenauraApi.request('/saved/');
      data = { books: result.books || [], poems: result.poems || [] };
    } catch (error) {
      showState(`<h3>Yuklab bo'lmadi</h3><p>${esc(error.message || 'Server bilan aloqa yo\'q.')}</p>`);
      return;
    }
    const hash = window.location.hash.replace('#', '');
    if (hash === 'poems' || hash === 'books') activeTab = hash;
    else if (!data.books.length && data.poems.length) activeTab = 'poems';
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();