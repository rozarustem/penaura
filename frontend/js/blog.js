/**
 * ============================================================
 *  Penaura — Blog Controller (js/blog.js)
 *  blog.html maqolalarni backend (API) dan oladi:
 *    GET /articles/?category=&page=   — chop etilgan maqolalar ro'yxati
 *    GET /articles/<slug>/            — bitta maqola (blog.html?post=<slug>)
 * ============================================================
 */
(function () {
  const PAGE_SIZE = 20; // backend PAGE_SIZE bilan bir xil bo'lishi kerak
  const esc = value => PenauraDOM.escapeHtml(value);
  let activeCategory = 'all';
  let currentPage = 1;
  let requestId = 0; // eski javob yangisining ustiga yozilib qolmasligi uchun

  // Sana tanlangan tilda chiqadi (i18n.js lug'ati sanalarni tarjima qila olmaydi)
  const MONTHS = {
    uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    ru: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
  };

  function currentLang() {
    if (window.PenauraI18n) return window.PenauraI18n.getLang();
    try {
      const value = localStorage.getItem('penaura_lang');
      return value === 'uz' || value === 'ru' ? value : 'en';
    } catch (error) { return 'en'; }
  }

  function formatDate(iso) {
    const date = iso ? new Date(iso) : null;
    if (!date || isNaN(date)) return '';
    const lang = currentLang();
    const months = MONTHS[lang];
    if (!months) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return lang === 'uz' ? `${day}-${month}, ${year}` : `${day} ${month} ${year}`;
  }

  function byline(article, withDate) {
    return [article.author, withDate ? formatDate(article.published_at) : '', article.read_time]
      .filter(Boolean).map(esc).join(' · ');
  }

  function postUrl(article) {
    return 'blog.html?post=' + encodeURIComponent(article.slug);
  }

  function message(text) {
    return `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--espresso-soft, #4A3226);"><h3>${esc(text)}</h3></div>`;
  }

  // --- BLOG RO'YXATI ---
  function renderCards(featuredEl, gridEl, articles, showFeatured) {
    const list = articles.slice();
    const feat = showFeatured ? list.shift() : null;

    if (featuredEl) {
      featuredEl.style.display = feat ? '' : 'none';
      featuredEl.innerHTML = feat ? `
        <a class="blog-featured-cover" href="${esc(postUrl(feat))}">
          ${feat.cover
            ? `<div class="ph has-img"><img src="${esc(feat.cover)}" alt="${esc(feat.title)}" loading="lazy"></div>`
            : `<div class="ph" style="display:flex; align-items:center; justify-content:center; font-family:var(--font-display, serif); font-size:1.3rem; color:var(--espresso, #2C1810); font-weight:700; padding:2rem; text-align:center; background:var(--card-bg, #F1EBDF);">${esc(feat.title)}</div>`}
        </a>
        <a class="blog-featured-copy" href="${esc(postUrl(feat))}">
          <div class="category">${esc(feat.category)}</div>
          <h2>${esc(feat.title)}</h2>
          <p>${esc(feat.summary)}</p>
          <div class="byline">${byline(feat, true)}</div>
        </a>` : '';
    }

    if (gridEl) {
      gridEl.innerHTML = list.map(art => `
        <a class="blog-card" href="${esc(postUrl(art))}">
          ${art.cover
            ? `<div class="ph has-img"><img src="${esc(art.cover)}" alt="${esc(art.title)}" loading="lazy"></div>`
            : `<div class="ph" style="display:flex; align-items:center; justify-content:center; font-family:var(--font-display, serif); font-size:0.95rem; font-weight:600; padding:1rem; text-align:center; color:var(--espresso, #2C1810);">${esc(art.title)}</div>`}
          <div class="category">${esc(art.category)}</div>
          <h3>${esc(art.title)}</h3>
          <p>${esc(art.summary)}</p>
          <div class="byline">${byline(art, false)}</div>
        </a>`).join('');
    }
  }

  function pageList(total, current) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current - 1, current, current + 1]);
    const sorted = Array.from(pages).filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
    const out = [];
    sorted.forEach((n, i) => {
      if (i && n - sorted[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  }

  function renderPagination(count) {
    const box = document.querySelector('.pagination');
    if (!box) return;
    const total = Math.ceil(count / PAGE_SIZE);
    box.style.display = total <= 1 ? 'none' : '';
    box.innerHTML = total <= 1 ? '' : pageList(total, currentPage).map(item =>
      item === '…'
        ? '<button class="page-btn" disabled>···</button>'
        : `<button class="page-btn${item === currentPage ? ' active' : ''}" data-page="${item}">${item}</button>`
    ).join('');
  }

  async function renderBlogHub() {
    const featuredEl = document.querySelector('.blog-featured');
    const gridEl = document.querySelector('.blog-grid');
    if (!featuredEl && !gridEl) return;

    const myRequest = ++requestId;
    if (featuredEl) { featuredEl.style.display = 'none'; featuredEl.innerHTML = ''; }
    if (gridEl) gridEl.innerHTML = message('Yuklanmoqda…');

    const query = new URLSearchParams({ page: String(currentPage) });
    if (activeCategory !== 'all') query.set('category', activeCategory);

    let data;
    try {
      data = await PenauraApi.request('/articles/?' + query, { public: true });
    } catch (error) {
      if (myRequest !== requestId) return;
      if (gridEl) gridEl.innerHTML = message('Maqolalarni yuklab bo\'lmadi. Keyinroq qayta urinib ko\'ring.');
      renderPagination(0);
      return;
    }
    if (myRequest !== requestId) return;

    const articles = Array.isArray(data) ? data : (data.results || []);
    const count = Array.isArray(data) ? articles.length : (data.count || 0);

    if (!articles.length) {
      if (gridEl) gridEl.innerHTML = message(activeCategory === 'all'
        ? 'Hozircha maqolalar yo\'q'
        : 'Bu toifada maqolalar topilmadi');
      renderPagination(0);
      return;
    }
    renderCards(featuredEl, gridEl, articles, currentPage === 1);
    renderPagination(count);
  }

  // --- BITTA MAQOLA ---
  function fillContent(container, raw) {
    container.replaceChildren();
    const text = String(raw || '');
    if (/<(p|h2|h3|ul|ol|blockquote|br)\b/i.test(text)) {
      container.appendChild(PenauraDOM.createSafeRichText(text));
      return;
    }
    text.split(/\n{2,}/).filter(Boolean).forEach(paragraph => {
      const element = document.createElement('p');
      element.textContent = paragraph;
      container.appendChild(element);
    });
  }

  function showPost(article) {
    document.title = `${article.title} — Penaura Blog`;
    document.getElementById('blog-post-category').textContent = article.category;
    document.getElementById('blog-post-title').textContent = article.title;
    document.getElementById('blog-post-byline').textContent =
      [article.author, formatDate(article.published_at), article.read_time].filter(Boolean).join(' · ');
    const figure = document.getElementById('blog-post-cover');
    if (figure) {
      const img = figure.querySelector('img');
      figure.hidden = !article.cover;
      if (article.cover) { img.src = article.cover; img.alt = article.title; } else { img.removeAttribute('src'); }
    }
    fillContent(document.getElementById('blog-post-content'), article.content);
  }

  async function renderSinglePost(slug) {
    const postView = document.getElementById('blog-post');
    const blogHub = document.getElementById('blog-hub');
    if (!postView) return;
    if (blogHub) blogHub.hidden = true;
    const hero = document.querySelector('.page-hero');
    if (hero) hero.hidden = true;
    postView.hidden = false;
    document.getElementById('blog-post-title').textContent = 'Yuklanmoqda…';

    try {
      showPost(await PenauraApi.request('/articles/' + encodeURIComponent(slug) + '/', { public: true }));
    } catch (error) {
      document.getElementById('blog-post-category').textContent = '';
      document.getElementById('blog-post-byline').textContent = '';
      document.getElementById('blog-post-title').textContent = error.status === 404
        ? 'Maqola topilmadi'
        : 'Maqolani yuklab bo\'lmadi';
      const content = document.getElementById('blog-post-content');
      content.replaceChildren();
      const note = document.createElement('p');
      note.textContent = error.status === 404
        ? 'Bu maqola mavjud emas yoki blogdan olib tashlangan.'
        : 'Server bilan aloqa yo\'q. Keyinroq qayta urinib ko\'ring.';
      content.appendChild(note);
    }
  }

  function initBlog() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('post') || params.get('id');
    document.addEventListener('penaura:langchange', () => {
      if (slug) renderSinglePost(slug); else renderBlogHub();
    });
    if (slug) { renderSinglePost(slug); return; }

    const pills = document.querySelectorAll('.pills .pill');
    pills.forEach(pill => {
      pill.addEventListener('click', function () {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        // Tugma matni tarjima qilinadi, shuning uchun toifa data-category dan olinadi
        activeCategory = (pill.dataset.category || pill.textContent).trim().toLowerCase();
        currentPage = 1;
        renderBlogHub();
      });
    });

    const pagination = document.querySelector('.pagination');
    if (pagination) {
      pagination.addEventListener('click', event => {
        const button = event.target.closest('[data-page]');
        if (!button) return;
        currentPage = Number(button.dataset.page);
        renderBlogHub();
        const hub = document.getElementById('blog-hub');
        if (hub) hub.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    renderBlogHub();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlog);
  } else {
    initBlog();
  }
})();