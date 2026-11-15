/**
 * ============================================================
 *  Penaura — Writer Profile Controller (js/writer-profile.js)
 *  Yozuvchi profili (writer_profil.html) backend (API) ma'lumotlari bilan ishlaydi.
 *   • O'z profili:   /auth/me/, /books/mine/, /poems/mine/   (barcha holatdagi asarlar)
 *   • Boshqa yozuvchi (?author=ID): /auth/writers/ID/, /books/?author=ID, /poems/?author=ID (faqat nashr qilinganlar)
 * ============================================================
 */
(function () {
  const esc = value => PenauraDOM.escapeHtml(value);
  const list = response => Array.isArray(response) ? response : ((response && response.results) || []);

  function formatCount(num) {
    num = Number(num) || 0;
    return num >= 1000 ? (num / 1000).toFixed(1).replace('.0', '') + 'K' : String(num);
  }

  /* holat -> [yozuv, css klass] */
  const STATUS = {
    published: ['Published', 'published'],
    submitted: ['In review', 'draft'],
    editing: ['In review', 'draft'],
    returned: ['Returned', 'draft'],
    hidden: ['Hidden', 'draft'],
    draft: ['Draft', 'draft'],
  };

  async function loadData() {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get('author') || params.get('id');

    let me = null;
    if (PenauraApi.getAccessToken()) {
      try { me = await PenauraApi.request('/auth/me/'); } catch (e) { me = null; }
    }
    if (!wanted && !me) { window.location.href = 'signin.html'; return null; }

    const own = !!me && (!wanted || String(me.id) === String(wanted));
    if (own) {
      const [books, poems] = await Promise.all([
        PenauraApi.request('/books/mine/'),
        PenauraApi.request('/poems/mine/'),
      ]);
      return { own, writer: me, books: list(books), poems: list(poems) };
    }

    const id = encodeURIComponent(wanted);
    const open = { public: true };
    const [writer, books, poems] = await Promise.all([
      PenauraApi.request('/auth/writers/' + id + '/', open),
      PenauraApi.request('/books/?author=' + id, open),
      PenauraApi.request('/poems/?author=' + id, open),
    ]);
    return { own, writer, books: list(books), poems: list(poems) };
  }

  function toWorks(data) {
    const books = data.books.map(book => ({
      type: 'book', id: book.id, slug: book.slug, title: book.title, genre: book.subgenre || book.genre || 'FICTION',
      cover: book.cover, status: book.status, views: book.views || 0, rating: Number(book.rating) || 0,
      likes: book.likes_count || 0,
      chapters: data.own ? (book.chapters_total || 0) : (book.chapters_count || 0),
      date: book.updated_at || book.created_at,
    }));
    const poems = data.poems.map(poem => ({
      type: 'poem', id: poem.id, slug: poem.slug, title: poem.title, genre: poem.genre || 'POETRY', cover: '',
      status: poem.is_hidden ? 'hidden' : poem.status, views: poem.views || 0, rating: Number(poem.rating) || 0,
      likes: 0, chapters: 0, date: poem.updated_at || poem.created_at,
    }));
    return [...books, ...poems].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  /* Boshqa yozuvchi profilida Follow tugmasi: kuzatilsa, yangi bob chiqqanda xabar keladi. */
  async function initFollowButton(writer) {
    const info = document.querySelector('.profile-info');
    if (!info || info.querySelector('.btn-follow-writer')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-follow-writer';
    btn.title = 'Yangi bob chiqqanda xabar olasiz';
    btn.style.cssText = 'margin-top:0.6rem; padding:0.45rem 1.1rem; border-radius:6px; cursor:pointer; ' +
      'font-size:0.9rem; border:1px solid var(--terracotta, #B5622E);';

    let following = false;
    let busy = false;
    let followers = Number(writer.followers_count) || 0;

    const render = () => {
      btn.textContent = following ? '\u2713 Following' : '\u2661 Follow';
      btn.style.background = following ? 'var(--terracotta, #B5622E)' : 'transparent';
      btn.style.color = following ? '#FAF8F4' : 'var(--terracotta, #B5622E)';
    };
    const showFollowers = () => {
      const cards = document.querySelectorAll('.profile-stat-card .num');
      if (cards[2]) cards[2].textContent = followers.toLocaleString();
    };

    if (PenauraApi.getAccessToken()) {
      try {
        const ids = await PenauraApi.request('/following/');
        following = list(ids).map(String).includes(String(writer.id));
      } catch (e) { /* kuzatish holati noma'lum bo'lsa, "Follow" ko'rsatiladi */ }
    }
    render();

    btn.addEventListener('click', async () => {
      if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }
      if (busy) return;
      busy = true;
      try {
        const result = await PenauraApi.request('/writers/' + encodeURIComponent(writer.id) + '/follow/', { method: 'POST' });
        following = !!result.following;
        followers = Math.max(0, followers + (following ? 1 : -1));
        render();
        showFollowers();
      } catch (e) {
        alert(e.message || 'Xatolik yuz berdi. Qayta urinib ko\'ring.');
      } finally {
        busy = false;
      }
    });
    info.appendChild(btn);
  }

  function renderHeader(data) {
    const writer = data.writer;
    const name = writer.full_name || 'Writer';
    const avatar = document.querySelector('.profile-avatar');
    if (avatar) {
      const initial = document.createElement('span');
      initial.className = 'profile-avatar-initial';
      initial.textContent = name.charAt(0).toUpperCase();
      avatar.replaceChildren(initial);
    }
    const nameEl = document.querySelector('.profile-info h2');
    if (nameEl) nameEl.textContent = name;
    const badge = document.querySelector('.role-badge');
    if (badge) badge.textContent = '✒ ' + String(writer.role || 'writer').toUpperCase();
    document.title = name + ' — Penaura';

    const newStory = document.querySelector('.btn-new-story');
    const settings = document.querySelector('.settings-link-row');
    if (data.own) {
      if (newStory) newStory.addEventListener('click', () => { window.location.href = 'upload.html'; });
    } else {
      if (newStory) newStory.style.display = 'none';
      if (settings) settings.style.display = 'none';
      initFollowButton(writer);
    }
  }

  function renderStats(data, works) {
    const published = works.filter(work => work.status === 'published');
    const reads = works.reduce((sum, work) => sum + work.views, 0);
    const rated = published.filter(work => work.rating > 0);
    const average = rated.length ? rated.reduce((sum, work) => sum + work.rating, 0) / rated.length : 0;
    const values = [
      published.length,
      formatCount(reads),
      (Number(data.writer.followers_count) || 0).toLocaleString(),
      average ? average.toFixed(1) : '—',
    ];
    document.querySelectorAll('.profile-stat-card .num').forEach((el, i) => {
      if (i < values.length) el.textContent = values[i];
    });
  }

  function renderWorks(data, works) {
    const container = document.querySelector('.section--flush-top .wrap');
    if (!container) return;
    container.querySelectorAll('.work-row, .empty-works').forEach(el => el.remove());

    if (!works.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-works';
      empty.style.cssText = 'text-align:center; padding:1.5rem 1rem; color:var(--espresso-soft, #4A3226);';
      empty.innerHTML = data.own
        ? `<h3 style="font-family:var(--font-display, serif); font-size:1.2rem; margin-bottom:0.5rem;">Hozircha asarlar yo'q</h3>
           <p style="margin-bottom:1.5rem; font-size:0.9rem;">Birinchi asaringizni yuklang va o'quvchilar bilan ulashing!</p>
           <a href="upload.html" class="btn-new-story" style="display:inline-block; text-decoration:none; padding:0.6rem 1.4rem; background:var(--terracotta, #B5622E); color:#FAF8F4; border-radius:var(--radius, 4px); font-family:var(--font-mono, monospace); font-size:0.85rem;">+ New Story</a>`
        : `<p style="font-size:0.95rem;">Bu yozuvchi hali asar nashr qilmagan.</p>`;
      container.appendChild(empty);
      return;
    }

    works.forEach(work => {
      const isPoem = work.type === 'poem';
      const [statusText, statusClass] = STATUS[work.status] || STATUS.draft;
      const title = esc(work.title);
      const coverUrl = PenauraDOM.getSafeImageUrl(work.cover);
      const cover = coverUrl
        ? `<img src="${esc(coverUrl)}" alt="${title}" loading="lazy" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`
        : 'cover';
      const slug = encodeURIComponent(work.slug || work.id);
      const bookUrl = `manage-book.html?book=${slug}`;
      const poemUrl = `poem.html?poem=${slug}`;
      const openUrl = isPoem ? poemUrl : bookUrl;

      const info = `
          <div class="ph" style="overflow:hidden; display:flex; align-items:center; justify-content:center;">${cover}</div>
          <div class="work-row-info">
            <div class="genre">${esc(String(work.genre).toUpperCase())}</div>
            <h4>${title} <span class="status-tag ${statusClass}">${statusText}</span></h4>
          </div>`;
      const stats = `
        <div class="work-row-stats">
          <span class="work-stat"><span class="stat-num">${formatCount(work.views)}</span><span class="work-stat-label">reads</span></span>
          <span class="work-stat"><span class="stat-num">${isPoem ? 'Poem' : work.chapters}</span><span class="work-stat-label">${isPoem ? '' : 'chapters'}</span></span>
          <span class="work-stat"><span class="stat-num">★ ${work.rating > 0 ? work.rating.toFixed(1) : '—'}</span><span class="work-stat-label">rating</span></span>
        </div>`;

      const row = document.createElement('div');
      row.className = 'work-row';
      if (data.own) {
        row.innerHTML = `
        <a class="work-row-open" href="${openUrl}" aria-label="Open ${title}">${info}
        </a>${stats}
        <div class="work-row-actions">
          ${isPoem ? '<a class="btn-edit" href="poem.html">Open Poetry</a>' : `<a class="btn-edit" href="${bookUrl}">Edit</a>`}
          <button class="btn-stats" type="button">Stats</button>
        </div>`;
        row.querySelector('.btn-stats').addEventListener('click', () => {
          alert(`"${work.title}" statistikasi:\n\n• Jami ko'rishlar: ${work.views}\n• Layklar: ${work.likes}` +
            (isPoem ? '' : `\n• Boblar soni: ${work.chapters}`) + `\n• Holati: ${statusText}`);
        });
      } else {
        row.innerHTML = `<div class="work-row-open">${info}\n        </div>${stats}`;
      }
      container.appendChild(row);
    });
  }

  async function init() {
    const container = document.querySelector('.section--flush-top .wrap');
    let data;
    try {
      data = await loadData();
    } catch (error) {
      if (container) {
        container.querySelectorAll('.work-row').forEach(el => el.remove());
        const message = document.createElement('p');
        message.style.cssText = 'padding:1.5rem 0; color:var(--terracotta, #B5622E);';
        message.textContent = (error && error.message) || 'Profilni yuklashda xatolik yuz berdi.';
        container.appendChild(message);
      }
      return;
    }
    if (!data) return;
    const works = toWorks(data);
    renderHeader(data);
    renderStats(data, works);
    renderWorks(data, works);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();