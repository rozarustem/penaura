/**
 * ============================================================
 *  Penaura — Home & Discover Controller (js/index.js)
 *  Bosh sahifa backend (API) ma'lumotlari bilan ishlaydi:
 *   1. Discover: nashr qilingan kitoblar (/books/) va she'rlar (/poems/), janr/qidiruv filtrlari
 *   2. Hero statistikasi: yozuvchilar, asarlar va o'qishlar soni (yuklangan ma'lumotdan)
 *   3. Latest Stories: nashr qilingan maqolalar (/articles/)
 *   4. Author Spotlight: eng ko'p o'qilgan yozuvchi (+ Follow tugmasi)
 *   5. "Start writing" tugmasi va newsletter
 * ============================================================
 */
(function () {
  const esc = value => PenauraDOM.escapeHtml(value);
  let activeFilter = 'all';
  let activeSearch = new URLSearchParams(window.location.search).get('search') || '';
  let ITEMS = [];

  /* ---------- Yordamchilar ---------- */
  function formatCount(num) {
    num = Number(num) || 0;
    return num >= 1000 ? (num / 1000).toFixed(1).replace('.0', '') + 'K' : String(num);
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
      type: 'book', slug: book.slug, title: book.title,
      author_id: book.author && book.author.id, author_name: book.author && book.author.full_name,
      genre: book.genre, subgenre: book.subgenre, tags: Array.isArray(book.tags) ? book.tags : [],
      views: book.views || 0, rating: Number(book.rating) || 0, cover: book.cover,
      chapters: book.chapters_count || 0, featured: !!book.is_featured,
    };
  }

  function normalizePoem(poem) {
    return {
      type: 'poem', slug: poem.slug, title: poem.title,
      author_id: poem.author && poem.author.id, author_name: poem.author && poem.author.full_name,
      genre: 'POETRY', subgenre: poem.topic, tags: Array.isArray(poem.tags) ? poem.tags : [],
      views: poem.views || 0, rating: Number(poem.rating) || 0, cover: '', chapters: 0, featured: false,
    };
  }

  const hrefFor = item => item.type === 'poem'
    ? 'poem.html?poem=' + encodeURIComponent(item.slug)
    : 'book.html?book=' + encodeURIComponent(item.slug);

  /* ---------- 1. Discover ---------- */
  function getFilteredItems() {
    let items = [...ITEMS];

    // Tahririyat tanlagan asarlar ro'yxatda birinchi chiqadi (qolgan tartib saqlanadi)
    if (activeFilter === 'all') items.sort((a, b) => Number(b.featured) - Number(a.featured));

    if (activeFilter === 'popular') {
      items.sort((a, b) => b.views - a.views);
    } else if (activeFilter !== 'all') {
      const g = activeFilter.toLowerCase();
      items = items.filter(item => {
        const bg = String(item.genre || '').toLowerCase();
        const bsg = String(item.subgenre || '').toLowerCase();
        const tags = item.tags.map(t => String(t).toLowerCase());
        return bg.includes(g) || bsg.includes(g) || tags.some(t => t.includes(g));
      });
    }

    if (activeSearch) {
      const query = activeSearch.toLowerCase();
      items = items.filter(item => String(item.title || '').toLowerCase().includes(query));
    }
    return items;
  }

  function renderDiscoverWorks() {
    const grid = document.getElementById('index-works-grid') || document.querySelector('.work-grid');
    const counterEl = document.getElementById('all-stories-counter');
    if (!grid) return;

    const items = getFilteredItems();
    if (counterEl) {
      if (activeSearch) counterEl.textContent = `${items.length} ta natija: "${activeSearch}"`;
      else if (activeFilter === 'all') counterEl.textContent = `Jami ${ITEMS.length} ta asar`;
      else counterEl.textContent = `${items.length} ta asar topildi (Jami: ${ITEMS.length})`;
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; background: var(--card-bg, #F1EBDF); border-radius: var(--radius, 4px); border: 1px dashed var(--line, #E4DDD0); color: var(--espresso-soft, #4A3226);">
          <div style="font-size: 2.5rem; margin-bottom: 0.6rem;">📚</div>
          <h3 style="font-family: var(--font-display, serif); font-size: 1.25rem; margin-bottom: 0.4rem; color: var(--espresso, #2C1810);">${activeSearch ? 'Bu nomdagi asar topilmadi' : (ITEMS.length ? "Bu janrda hali asar yo'q" : "Hozircha nashr qilingan asarlar yo'q")}</h3>
          <p style="font-size: 0.88rem; max-width: 400px; margin: 0 auto 1.5rem;">${activeSearch ? 'Boshqa nomni sinab ko‘ring.' : "Birinchi bo'lib asar yaratishingiz mumkin!"}</p>
          <a href="upload.html" class="btn-primary" style="display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none; padding: 0.65rem 1.4rem; font-size: 0.88rem;">+ Birinchi asarni yuklash</a>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      const authorName = item.author_name || 'Muallif';
      const rating = item.rating > 0 ? item.rating.toFixed(1) : '—';
      const genre = String(item.subgenre && item.type === 'book' ? item.subgenre : (item.genre || 'FICTION')).toUpperCase();
      const safeTitle = esc(item.title);
      const safeAuthor = esc(authorName);
      const coverUrl = PenauraDOM.getSafeImageUrl(item.cover);
      const coverContent = coverUrl
        ? `<img src="${esc(coverUrl)}" alt="${safeTitle}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`
        : `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; padding:1rem; text-align:center;">
            <span style="font-family:var(--font-display, serif); font-weight:700; font-size:1.05rem; line-height:1.25; color:var(--espresso, #2C1810);">${safeTitle}</span>
            <span style="font-family:var(--font-mono, monospace); font-size:0.75rem; color:var(--terracotta, #B5622E); margin-top:0.4rem;">${safeAuthor}</span>
          </div>`;
      const badge = item.type === 'poem' ? "she'r" : `${item.chapters} bob`;

      return `
        <a class="work-card" href="${hrefFor(item)}" style="transition:transform 0.18s ease, box-shadow 0.18s ease; display:flex; flex-direction:column;">
          <div class="ph" style="height:190px; overflow:hidden; display:flex; align-items:center; justify-content:center; position:relative; background:var(--card-bg, #F1EBDF); border-radius:var(--radius, 4px);">
            ${coverContent}
            <span style="position:absolute; bottom:8px; right:8px; background:rgba(44,24,16,0.75); color:#FAF8F4; font-family:var(--font-mono, monospace); font-size:0.68rem; padding:0.15rem 0.45rem; border-radius:3px;">${badge}</span>
          </div>
          <div class="genre" style="margin-top:0.6rem;">${esc(genre)}</div>
          <h3 style="margin:0.25rem 0 0.2rem; font-size:1.15rem; font-family:var(--font-display, serif); font-weight:700;">${safeTitle}</h3>
          <div class="author" style="font-size:0.9rem; color:var(--espresso-soft, #4A3226); margin-bottom:0.3rem;">${safeAuthor}</div>
          <div class="meta" style="margin-top:auto; font-size:0.78rem; font-family:var(--font-mono, monospace); color:var(--espresso-soft, #4A3226);">★ ${rating} · ${formatCount(item.views)} reads</div>
        </a>`;
    }).join('');
  }

  function initPills() {
    const pills = document.querySelectorAll('.pills .pill');
    pills.forEach(pill => {
      pill.addEventListener('click', function (e) {
        e.preventDefault();
        pills.forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        activeFilter = this.getAttribute('data-genre') || this.textContent.trim().toLowerCase();
        renderDiscoverWorks();
      });
    });
  }

  /* ---------- 2. Hero statistikasi ---------- */
  function renderHeroStats() {
    const stats = document.querySelectorAll('.stats-row .stat');
    if (stats.length < 3) return;
    const writers = new Set(ITEMS.map(item => item.author_id).filter(Boolean)).size;
    const reads = ITEMS.reduce((sum, item) => sum + item.views, 0);
    [[writers, 'WRITERS'], [ITEMS.length, 'STORIES'], [formatCount(reads), 'READS']].forEach(([value, label], i) => {
      stats[i].querySelector('.num').textContent = value;
      stats[i].querySelector('.label').textContent = label;
    });
  }

  /* ---------- 3. Hero tugmalari ---------- */
  function initHeroButtons() {
    const scrollToDiscover = () => {
      const section = document.getElementById('discover');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const exploreBtn = document.getElementById('btn-hero-explore');
    if (exploreBtn) exploreBtn.addEventListener('click', e => { e.preventDefault(); scrollToDiscover(); });

    const writeBtn = document.getElementById('btn-hero-write');
    if (writeBtn) {
      writeBtn.addEventListener('click', e => {
        e.preventDefault();
        window.location.href = PenauraApi.getAccessToken() ? 'upload.html' : 'signup.html';
      });
    }

    const statsRow = document.querySelector('.stats-row');
    if (statsRow) {
      statsRow.style.cursor = 'pointer';
      statsRow.addEventListener('click', scrollToDiscover);
    }
  }

  /* ---------- 4. Latest Stories (maqolalar) ---------- */
  function formatDate(value) {
    const date = new Date(value);
    return isNaN(date) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderLatestArticles(articles) {
    const latestGrid = document.querySelector('.latest-grid');
    if (!latestGrid) return;

    if (!articles.length) {
      latestGrid.innerHTML = `<p style="grid-column:1/-1; padding:2rem 0; color:var(--espresso-soft, #4A3226);">Hozircha maqolalar yo'q.</p>`;
      return;
    }

    const main = articles[0];
    const latestMain = latestGrid.querySelector('.latest-main');
    if (latestMain) {
      latestMain.innerHTML = `
        <a class="latest-main-link" href="blog.html?post=${encodeURIComponent(main.slug)}" style="text-decoration:none; color:inherit; display:block;">
          <div class="ph" style="display:flex; align-items:center; justify-content:center; background:var(--card-bg, #F1EBDF); font-family:var(--font-display, serif); font-size:1.15rem; color:var(--espresso, #2C1810); padding:1rem; text-align:center;">${esc(main.title)}</div>
          <div class="genre" style="margin-top:0.6rem;">${esc(main.category)}</div>
          <h3 style="margin:0.3rem 0; font-family:var(--font-display, serif); font-size:1.35rem;">${esc(main.title)}</h3>
          <p style="color:var(--espresso-soft, #4A3226); font-size:0.95rem; line-height:1.6;">${esc(main.summary)}</p>
          <div class="byline" style="font-family:var(--font-mono, monospace); font-size:0.8rem; color:var(--terracotta, #B5622E);">${esc(main.author)} · ${esc(formatDate(main.published_at || main.created_at))} · ${esc(main.read_time)}</div>
        </a>`;
    }

    const sideList = latestGrid.querySelector('.side-list');
    if (sideList) {
      sideList.innerHTML = articles.slice(1, 4).map(art => `
        <a class="side-item" href="blog.html?post=${encodeURIComponent(art.slug)}" style="display:flex; gap:1rem; align-items:center; margin-bottom:1.2rem; text-decoration:none; color:inherit;">
          <div class="ph" style="width:70px; height:70px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:0.75rem; color:var(--espresso-soft, #4A3226); background:var(--card-bg, #F1EBDF); border-radius:var(--radius, 4px);">img</div>
          <div>
            <div class="genre" style="font-size:0.7rem; font-family:var(--font-mono, monospace); color:var(--terracotta, #B5622E);">${esc(art.category)}</div>
            <h4 style="margin:0.2rem 0; font-family:var(--font-display, serif); font-size:0.98rem;">${esc(art.title)}</h4>
            <div class="byline" style="font-family:var(--font-mono, monospace); font-size:0.72rem; color:var(--espresso-soft, #4A3226);">${esc(art.author)} · ${esc(art.read_time)}</div>
          </div>
        </a>`).join('');
    }
  }

  /* ---------- 5. Author Spotlight (eng ko'p o'qilgan yozuvchi) ---------- */
  async function renderSpotlight() {
    const grid = document.querySelector('.author-grid');
    const section = grid && grid.closest('section');
    if (!grid) return;

    const byAuthor = new Map();
    ITEMS.forEach(item => {
      if (!item.author_id) return;
      const entry = byAuthor.get(item.author_id) || { id: item.author_id, name: item.author_name, works: [], reads: 0 };
      entry.works.push(item);
      entry.reads += item.views;
      byAuthor.set(item.author_id, entry);
    });
    // Tahririyat tanlagan oy muallifi; tanlanmagan bo'lsa — eng ko'p o'qilgan yozuvchi
    let chosenId = null;
    try { const pick = await PenauraApi.request('/auth/spotlight/', { public: true }); chosenId = pick && pick.id; } catch (e) { /* tanlov olinmasa avtomatik tanlanadi */ }
    const top = (chosenId && byAuthor.get(chosenId)) || [...byAuthor.values()].sort((a, b) => b.reads - a.reads)[0];
    if (!top) { if (section) section.style.display = 'none'; return; }

    let profile = { full_name: top.name, bio: '', followers_count: 0 };
    try { profile = await PenauraApi.request('/auth/writers/' + top.id + '/', { public: true }); } catch (e) { /* profil ochiq bo'lmasa, mavjud ma'lumot bilan davom etamiz */ }

    const topWork = [...top.works].filter(w => w.type === 'book').sort((a, b) => b.views - a.views)[0] || top.works[0];
    const genres = [...new Set(top.works.map(w => w.subgenre && w.type === 'book' ? w.subgenre : w.genre))].slice(0, 2).join(' · ');

    const card = grid.querySelector('.author-card');
    if (card) {
      card.querySelector('h3').textContent = profile.full_name || top.name || 'Muallif';
      card.querySelector('.sub').textContent = `${genres} · ${profile.followers_count || 0} followers`;
      card.querySelector('.bio').textContent = profile.bio || `${top.works.length} ta asar muallifi.`;
      const nums = card.querySelectorAll('.author-stats > div');
      if (nums.length >= 3) {
        [[top.works.length, 'WORKS'], [formatCount(top.reads), 'READS'], [profile.followers_count || 0, 'FOLLOWERS']].forEach(([value, label], i) => {
          nums[i].querySelector('.num').textContent = value;
          nums[i].querySelector('.label').textContent = label;
        });
      }
      initFollow(card.querySelector('.btn-follow'), top.id);
    }

    const featured = grid.querySelector('.featured-novella');
    if (featured && topWork) {
      featured.querySelector('.genre').textContent = String(topWork.genre || '').toUpperCase();
      featured.querySelector('h3').textContent = topWork.title;
      const quote = featured.querySelector('blockquote');
      if (quote) quote.style.display = 'none';
      const link = featured.querySelector('.start-link');
      if (link) link.href = hrefFor(topWork);
    }
  }

  async function initFollow(btn, writerId) {
    if (!btn) return;
    const setState = following => {
      btn.classList.toggle('following', following);
      btn.textContent = following ? '✓ Following' : '♡ Follow & Read';
      btn.style.background = following ? 'var(--terracotta, #B5622E)' : 'transparent';
      btn.style.color = following ? '#FAF8F4' : 'inherit';
    };
    setState(false);
    if (PenauraApi.getAccessToken()) {
      try {
        const ids = await PenauraApi.request('/following/');
        setState(Array.isArray(ids) && ids.includes(writerId));
      } catch (e) { /* kuzatuv holati noma'lum bo'lsa, oddiy holatda qoladi */ }
    }
    btn.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }
      try {
        const result = await PenauraApi.request('/writers/' + writerId + '/follow/', { method: 'POST' });
        setState(!!result.following);
      } catch (error) { alert(error.message || "Kuzatib bo'lmadi."); }
    });
  }

  /* ---------- 6. Newsletter ---------- */
  function initNewsletter() {
    document.querySelectorAll('.newsletter, .subscribe-row').forEach(sec => {
      const btn = sec.querySelector('button');
      const input = sec.querySelector('input[type="email"]');
      if (!btn || !input) return;
      btn.addEventListener('click', e => {
        e.preventDefault();
        const email = input.value.trim();
        if (!email || !email.includes('@')) {
          alert("Iltimos, to'g'ri email manzilini kiriting.");
          input.focus();
          return;
        }
        btn.textContent = "Obuna bo'lindi ✓";
        btn.style.background = '#2E7D32';
        input.disabled = true;
      });
    });
  }

  /* ---------- Ishga tushirish ---------- */
  async function initIndex() {
    initPills();
    initHeroButtons();
    initNewsletter();

    const grid = document.getElementById('index-works-grid') || document.querySelector('.work-grid');
    if (grid) grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--espresso-soft, #4A3226);">Yuklanmoqda…</p>';

    const [books, poems, articles] = await Promise.all([
      fetchAll('/books/?ordering=-created_at').catch(() => null),
      fetchAll('/poems/?ordering=-created_at').catch(() => null),
      fetchAll('/articles/').catch(() => []),
    ]);

    if (books === null && poems === null) {
      if (grid) grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--terracotta, #B5622E);">Ma'lumotni yuklab bo'lmadi. Server ishlayotganini tekshiring.</p>`;
      return;
    }

    // Faqat nashr qilinganlar (yozuvchi o'z qoralamalarini ham ro'yxatda ko'rishi mumkin)
    ITEMS = [
      ...(books || []).filter(b => b.status === 'published').map(normalizeBook),
      ...(poems || []).filter(p => p.status === 'published' && !p.is_hidden).map(normalizePoem),
    ];

    renderDiscoverWorks();
    renderHeroStats();
    renderLatestArticles(articles);
    renderSpotlight();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initIndex);
  else initIndex();
})();