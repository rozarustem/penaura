/**
 * ============================================================
 *  Penaura — Public Book Page (js/book.js)
 *  book.html?book=<slug>                 — kitob sahifasi (tavsif, boblar ro'yxati, layk)
 *  book.html?book=<slug>&chapter=<id>    — bobni o'qish (premium bob tanga bilan ochiladi)
 *  Ma'lumot: /books/<slug>/, /books/<slug>/chapters/<id>/, /books/<slug>/like/, /books/<slug>/bookmark/, /books/<slug>/chapters/<id>/unlock/
 * ============================================================
 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = value => PenauraDOM.escapeHtml(value);
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('book');
  const chapterParam = params.get('chapter');
  const apiBook = () => '/books/' + encodeURIComponent(slug) + '/';
  const pageUrl = chapterId => 'book.html?book=' + encodeURIComponent(slug) +
    (chapterId ? '&chapter=' + encodeURIComponent(chapterId) : '');

  let book = null;
  let chapters = [];

  function formatCount(num) {
    num = Number(num) || 0;
    return num >= 1000 ? (num / 1000).toFixed(1).replace('.0', '') + 'K' : String(num);
  }

  function showError(message) {
    const state = $('book-state');
    state.hidden = false;
    state.classList.add('is-error');
    state.textContent = message;
    $('book-view').hidden = true;
    $('reader-view').hidden = true;
  }

  function friendly(error) {
    const message = (error && error.message) || '';
    return /not found|topilmadi/i.test(message) || !message
      ? 'Kitob topilmadi yoki hali nashr qilinmagan.'
      : message;
  }

  /* ---------- Muallif bloki va uning boshqa asarlari ---------- */
  const list = response => Array.isArray(response) ? response : ((response && response.results) || []);
  const initialOf = name => (String(name || '?').trim().charAt(0) || '?').toUpperCase();
  const profileUrl = id => 'writer_profil.html?author=' + encodeURIComponent(id);

  function fillAvatar(el, writer, name) {
    const url = PenauraDOM.getSafeImageUrl(writer && writer.avatar);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = name;
      el.replaceChildren(img);
    } else {
      el.textContent = initialOf(name);
    }
  }

  function workCard(work) {
    const isPoem = work.type === 'poem';
    const href = isPoem
      ? 'poem.html?poem=' + encodeURIComponent(work.slug)
      : 'book.html?book=' + encodeURIComponent(work.slug);
    const coverUrl = isPoem ? '' : PenauraDOM.getSafeImageUrl(work.cover);
    const cover = coverUrl
      ? `<img src="${esc(coverUrl)}" alt="${esc(work.title)}">`
      : `<span>${esc(work.title)}</span>`;
    const label = isPoem ? 'POEM' : String(work.subgenre || work.genre || 'FICTION').toUpperCase();
    return `<a class="work-card" href="${esc(href)}">
        <div class="work-cover">${cover}</div>
        <div class="work-title">${esc(work.title)}</div>
        <div class="work-meta">${esc(label)} · ${formatCount(work.views)} reads</div>
      </a>`;
  }

  async function initFollow(writerId, followers) {
    const btn = $('btn-follow-author');
    let me = null;
    if (PenauraApi.getAccessToken()) {
      try { me = await PenauraApi.request('/auth/me/'); } catch (error) { me = null; }
    }
    if (me && String(me.id) === String(writerId)) { btn.hidden = true; return; } // o'z kitobi

    let following = false;
    let busy = false;
    if (me) {
      try {
        const ids = list(await PenauraApi.request('/following/'))
          .map(item => String(item && typeof item === 'object' ? item.id : item));
        following = ids.includes(String(writerId));
      } catch (error) { /* holat noma'lum bo'lsa, "Follow" ko'rsatiladi */ }
    }
    const paint = () => {
      btn.textContent = following ? '\u2713 Following' : '\u2661 Follow';
      btn.classList.toggle('is-following', following);
    };
    paint();

    btn.addEventListener('click', async () => {
      if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }
      if (busy) return;
      busy = true;
      try {
        const result = await PenauraApi.request('/writers/' + encodeURIComponent(writerId) + '/follow/', { method: 'POST' });
        following = !!result.following;
        followers = Math.max(0, followers + (following ? 1 : -1));
        const counter = $('author-followers');
        if (counter) counter.textContent = formatCount(followers);
        paint();
      } catch (error) {
        alert(error.message || 'Xatolik yuz berdi. Qayta urinib ko\'ring.');
      } finally {
        busy = false;
      }
    });
  }

  async function renderAuthor() {
    const info = book && book.author;
    if (!info || !info.id) return;
    const id = encodeURIComponent(info.id);
    const open = { public: true };
    const [writer, books, poems] = await Promise.all([
      PenauraApi.request('/auth/writers/' + id + '/', open).catch(() => null),
      PenauraApi.request('/books/?author=' + id, open).catch(() => []),
      PenauraApi.request('/poems/?author=' + id, open).catch(() => []),
    ]);
    const name = (writer && writer.full_name) || info.full_name || 'Muallif';
    const allBooks = list(books);
    const allPoems = list(poems);
    const followers = Number(writer && writer.followers_count) || 0;

    fillAvatar($('byline-avatar'), writer, name);
    fillAvatar($('author-avatar'), writer, name);
    $('author-avatar').href = profileUrl(info.id);
    const nameLink = $('author-name');
    nameLink.textContent = name;
    nameLink.href = profileUrl(info.id);
    $('author-profile-link').href = profileUrl(info.id);

    $('author-stats').innerHTML =
      `<span><strong>${allBooks.length}</strong> books</span>` +
      (allPoems.length ? `<span><strong>${allPoems.length}</strong> poems</span>` : '') +
      `<span><strong id="author-followers">${formatCount(followers)}</strong> followers</span>`;
    const bio = $('author-bio');
    bio.textContent = (writer && writer.bio) || '';
    bio.hidden = !bio.textContent;
    $('author-card').hidden = false;
    initFollow(info.id, followers);

    const others = [
      ...allBooks.filter(item => item.slug !== book.slug).map(item => ({ ...item, type: 'book' })),
      ...allPoems.map(item => ({ ...item, type: 'poem' })),
    ];
    if (others.length) {
      $('author-works-title').textContent = 'More from ' + name;
      $('author-works-grid').innerHTML = others.slice(0, 8).map(workCard).join('');
      $('author-works-more').href = profileUrl(info.id);
      $('author-works-more').hidden = others.length <= 8;
      $('author-works').hidden = false;
    }
  }

  /* ---------- Kitob sahifasi ---------- */
  function renderBook() {
    document.title = book.title + ' — Penaura';
    $('book-genre').textContent = String(book.subgenre || book.genre || 'FICTION').toUpperCase();
    $('book-title').textContent = book.title;

    const authorName = (book.author && book.author.full_name) || 'Muallif';
    $('book-author').textContent = authorName;
    $('byline-avatar').textContent = initialOf(authorName);
    if (book.author && book.author.id) $('book-byline').href = profileUrl(book.author.id);

    const coverUrl = PenauraDOM.getSafeImageUrl(book.cover);
    $('book-cover').innerHTML = coverUrl
      ? `<img src="${esc(coverUrl)}" alt="${esc(book.title)}">`
      : `<span>${esc(book.title)}</span>`;

    const rating = Number(book.rating) || 0;
    $('book-stats').innerHTML =
      `<span><strong>${formatCount(book.views)}</strong> reads</span>` +
      `<span><strong>${chapters.length}</strong> chapters</span>` +
      (rating > 0 ? `<span>★ <strong>${rating.toFixed(1)}</strong></span>` : '') +
      (book.language ? `<span>${esc(String(book.language).toUpperCase())}</span>` : '');

    $('book-desc').textContent = book.description || '';
    const tags = Array.isArray(book.tags) ? book.tags : [];
    $('book-tags').innerHTML = tags.map(tag => `<span>${esc(tag)}</span>`).join('');
    $('like-count').textContent = book.likes_count || 0;

    const startBtn = $('btn-start-reading');
    if (chapters.length) startBtn.href = pageUrl(chapters[0].id);
    else startBtn.style.display = 'none';

    $('chapter-list').innerHTML = chapters.length
      ? chapters.map((chapter, index) => `
          <li><a href="${pageUrl(chapter.id)}">
            <span class="chapter-num">${String(index + 1).padStart(2, '0')}</span>
            <span class="chapter-name">${esc(chapter.title || 'Chapter ' + (index + 1))}</span>
            ${chapter.is_premium
              ? `<span class="chapter-tag is-premium">⭐ ${Number(chapter.price) || 0} coins</span>`
              : '<span class="chapter-tag">Free</span>'}
          </a></li>`).join('')
      : '<li class="chapter-empty">Hozircha nashr qilingan boblar yo\'q.</li>';

    $('btn-like').addEventListener('click', async () => {
      if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }
      try {
        const result = await PenauraApi.request(apiBook() + 'like/', { method: 'POST' });
        $('like-count').textContent = result.likes_count;
        $('btn-like').classList.toggle('is-liked', !!result.liked);
      } catch (error) { alert(error.message || 'Layk qo\'yib bo\'lmadi.'); }
    });

    /* Saqlash (Bookmark): keyin "Saqlanganlar" sahifasida (saved.html) ko'rinadi */
    const saveBtn = $('btn-save');
    if (saveBtn) {
      const paintSaved = saved => {
        saveBtn.textContent = saved ? '🔖 Saved' : '🔖 Save';
        saveBtn.setAttribute('aria-pressed', String(saved));
        saveBtn.classList.toggle('is-saved', saved);
      };
      paintSaved(!!book.is_saved);
      saveBtn.addEventListener('click', async () => {
        if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }
        try {
          const result = await PenauraApi.request(apiBook() + 'bookmark/', { method: 'POST' });
          paintSaved(!!result.saved);
        } catch (error) { alert(error.message || 'Saqlab bo\'lmadi.'); }
      });
    }

    $('book-state').hidden = true;
    $('book-view').hidden = false;
  }

  /* ---------- Bobni o'qish ---------- */
  function bodyToNodes(content) {
    const html = /<p(?:\s|>)/i.test(content)
      ? content
      : '<p>' + esc(content).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
    return PenauraDOM.createSafeRichText(html);
  }

  function setNav(link, chapter) {
    if (chapter) { link.href = pageUrl(chapter.id); link.classList.remove('is-disabled'); }
    else { link.removeAttribute('href'); link.classList.add('is-disabled'); }
  }

  async function renderChapter(chapterId) {
    const index = chapters.findIndex(c => String(c.id) === String(chapterId));
    $('reader-back').href = pageUrl();
    $('reader-counter').textContent = index >= 0 ? `CHAPTER ${index + 1} OF ${chapters.length}` : '';
    setNav($('reader-prev'), index > 0 ? chapters[index - 1] : null);
    setNav($('reader-next'), index >= 0 ? chapters[index + 1] : null);

    let data;
    try {
      data = await PenauraApi.request(apiBook() + 'chapters/' + encodeURIComponent(chapterId) + '/');
    } catch (error) {
      return showError(friendly(error));
    }

    document.title = `${data.title} — ${book.title} — Penaura`;
    $('reader-title').textContent = data.title || 'Chapter';
    const content = $('reader-content');
    const locked = $('reader-locked');

    if (data.locked) {
      content.replaceChildren();
      locked.hidden = false;
      $('locked-text').textContent = `This chapter costs ${Number(data.price) || 0} coins.`;
      $('locked-error').hidden = true;
      const unlockBtn = $('btn-unlock');
      unlockBtn.textContent = `Unlock for ${Number(data.price) || 0} coins`;
      unlockBtn.onclick = () => unlock(chapterId);
    } else {
      locked.hidden = true;
      content.replaceChildren(bodyToNodes(data.content || ''));
    }

    $('book-state').hidden = true;
    $('book-view').hidden = true;
    $('reader-view').hidden = false;
    window.scrollTo(0, 0);
  }

  async function unlock(chapterId) {
    if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }
    const errorBox = $('locked-error');
    errorBox.hidden = true;
    try {
      await PenauraApi.request(apiBook() + 'chapters/' + encodeURIComponent(chapterId) + '/unlock/', { method: 'POST' });
      await renderChapter(chapterId);
    } catch (error) {
      errorBox.textContent = (error.message || 'Bobni ochib bo\'lmadi.') + ' ';
      if (/tanga|coin/i.test(error.message || '')) {
        const buy = document.createElement('a');
        buy.href = 'coins.html';
        buy.textContent = 'Buy coins →';
        errorBox.appendChild(buy);
      }
      errorBox.hidden = false;
    }
  }

  async function init() {
    if (!slug) return showError('Kitob ko\'rsatilmagan.');
    try {
      book = await PenauraApi.request(apiBook());
    } catch (error) {
      return showError(friendly(error));
    }
    chapters = (book.chapters || []).filter(c => c.status === 'published')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    renderBook();
    renderAuthor().catch(() => { /* muallif bloki yuklanmasa ham kitob sahifasi ishlayveradi */ });
    if (chapterParam) await renderChapter(chapterParam);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();