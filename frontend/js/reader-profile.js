/**
 * ============================================================
 *  Penaura — Reader Profile Controller (js/reader-profile.js)
 *  O'quvchi profili (reader_profil.html) backend (API) bilan ishlaydi:
 *    /auth/me/            — ism, avatar, ro'yxatdan o'tgan sana
 *    /auth/wallet/        — tanga balansi va tranzaksiyalar
 *    /reading-progress/   — o'qilayotgan kitoblar
 *    /following/          — kuzatilayotgan yozuvchilar ID lari
 *    /auth/writers/<id>/  — yozuvchining ochiq profili
 *    /writers/<id>/follow/ — kuzatishni yoqish/o'chirish (toggle)
 * ============================================================
 */
(function () {
  const esc = value => PenauraDOM.escapeHtml(value);
  const $ = id => document.getElementById(id);

  function setAvatar(el, name, avatarUrl) {
    if (!el) return;
    const safe = PenauraDOM.getSafeImageUrl(avatarUrl);
    if (safe) {
      const img = document.createElement('img');
      img.src = safe;
      img.alt = name || '';
      img.className = 'avatar-img';
      img.addEventListener('error', () => setAvatar(el, name, ''));
      el.replaceChildren(img);
      return;
    }
    const initial = document.createElement('span');
    initial.className = 'profile-avatar-initial';
    initial.textContent = (name || 'R').trim().charAt(0).toUpperCase() || 'R';
    el.replaceChildren(initial);
  }

  function renderHeader(me) {
    setAvatar(document.querySelector('.profile-avatar'), me.full_name, me.avatar);
    const nameEl = document.querySelector('.profile-info h2');
    if (nameEl) nameEl.textContent = me.full_name || 'Reader';
    document.title = (me.full_name || 'My Profile') + ' — Penaura';
    const buy = document.querySelector('.btn-buy-coins');
    if (buy) buy.addEventListener('click', () => { window.location.href = 'coins.html'; });
  }

  function renderWallet(wallet) {
    const coinsEl = document.querySelector('.coin-widget .num');
    if (!coinsEl) return;
    coinsEl.textContent = wallet ? `${Number(wallet.balance) || 0} coins` : '— coins';
    const rows = wallet ? (wallet.transactions || []) : [];
    const unlocked = rows.filter(row => row.kind === 'chapter_unlock').length;
    // Backend faqat oxirgi 50 ta tranzaksiyani qaytaradi
    $('stat-unlocked').textContent = !wallet ? '—' : (rows.length >= 50 ? unlocked + '+' : String(unlocked));
  }

  function renderStats(me, progress, followingCount) {
    $('stat-started').textContent = String(progress.length);
    $('stat-following').textContent = String(followingCount);
    const joined = me.date_joined ? new Date(me.date_joined) : null;
    $('stat-joined').textContent = joined && !isNaN(joined)
      ? joined.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      : '—';
  }

  function bookUrl(row, withChapter) {
    return 'book.html?book=' + encodeURIComponent(row.book_slug) +
      (withChapter && row.chapter_id ? '&chapter=' + encodeURIComponent(row.chapter_id) : '');
  }

  function renderReading(progress) {
    const grid = $('reading-grid');
    if (!grid) return;
    if (!progress.length) {
      grid.innerHTML = '<p class="empty-note">Hali birorta kitob o\'qishni boshlamadingiz. ' +
        '<a href="fiction.html">Kitoblarni ko\'rish →</a></p>';
      return;
    }
    grid.innerHTML = progress.slice(0, 6).map(row => {
      const total = Number(row.chapters_total) || 0;
      const pos = Math.min(Number(row.chapter_position) || 0, total);
      const percent = total ? Math.round((pos / total) * 100) : 0;
      const cover = PenauraDOM.getSafeImageUrl(row.cover);
      const label = row.chapter_id
        ? `Chapter ${pos} of ${total} · ${percent}% complete`
        : `${total} chapters · not started yet`;
      return `
        <div class="reading-item">
          <div class="ph">${cover ? `<img src="${esc(cover)}" alt="" class="reading-cover">` : 'cover'}</div>
          <div class="reading-item-info">
            <h4>${esc(row.book_title)}</h4>
            <div class="author">${esc(row.author_name)}</div>
            <div class="progress-track"><div class="progress-fill" style="width:${percent}%;"></div></div>
            <div class="progress-label">${esc(label)}</div>
          </div>
          <a class="btn-continue" href="${esc(bookUrl(row, true))}">Continue →</a>
        </div>`;
    }).join('');
  }

  function writerCard(writer) {
    const name = writer.full_name || 'Writer';
    const count = Number(writer.followers_count) || 0;
    return `
      <div class="following-card" data-writer="${esc(writer.id)}">
        <div class="following-avatar" data-name="${esc(name)}" data-avatar="${esc(writer.avatar || '')}"></div>
        <div class="following-info">
          <a class="following-name" href="writer_profil.html?author=${encodeURIComponent(writer.id)}">${esc(name)}</a>
          <div class="following-meta">${count.toLocaleString()} follower${count === 1 ? '' : 's'}</div>
        </div>
        <button type="button" class="btn-unfollow" data-id="${esc(writer.id)}">Unfollow</button>
      </div>`;
  }

  function renderFollowing(writers) {
    const grid = $('following-grid');
    if (!grid) return;
    if (!writers.length) {
      grid.innerHTML = '<p class="empty-note">Siz hali birorta yozuvchini kuzatmayapsiz. ' +
        '<a href="fiction.html">Yozuvchilarni kashf eting →</a></p>';
      return;
    }
    grid.innerHTML = writers.map(writerCard).join('');
    grid.querySelectorAll('.following-avatar').forEach(el => {
      setAvatar(el, el.dataset.name, el.dataset.avatar);
    });
  }

  async function unfollow(button) {
    const id = button.dataset.id;
    button.disabled = true;
    try {
      const result = await PenauraApi.request('/writers/' + encodeURIComponent(id) + '/follow/', { method: 'POST' });
      if (result && result.following === false) {
        const card = button.closest('.following-card');
        if (card) card.remove();
        const left = document.querySelectorAll('#following-grid .following-card').length;
        $('stat-following').textContent = String(left);
        if (!left) renderFollowing([]);
      } else {
        // Server holati "kuzatilmoqda" bo'lib qoldi (toggle qayta yoqdi) — tugmani qaytaramiz
        button.disabled = false;
      }
    } catch (error) {
      button.disabled = false;
      alert(error.message || 'Amalni bajarib bo\'lmadi.');
    }
  }

  async function init() {
    if (!PenauraApi.getAccessToken()) { window.location.href = 'signin.html'; return; }

    let me;
    try {
      me = await PenauraApi.request('/auth/me/');
    } catch (error) {
      return; // 401 bo'lsa api-client o'zi signin ga yo'naltiradi
    }
    if (me.role === 'writer') { window.location.replace('writer_profil.html'); return; }

    PenauraApi.syncUser(me);
    renderHeader(me);

    const [wallet, progressRaw, followIds] = await Promise.all([
      PenauraApi.request('/auth/wallet/').catch(() => null),
      PenauraApi.request('/reading-progress/').catch(() => []),
      PenauraApi.request('/following/').catch(() => null),
    ]);
    const progress = Array.isArray(progressRaw) ? progressRaw : [];

    renderWallet(wallet);
    renderReading(progress);

    if (followIds === null) {
      $('stat-following').textContent = '—';
      $('following-grid').innerHTML = '<p class="empty-note">Kuzatilayotgan yozuvchilarni yuklab bo\'lmadi.</p>';
    } else {
      const writers = (await Promise.all(
        followIds.map(id => PenauraApi.request('/auth/writers/' + encodeURIComponent(id) + '/', { public: true }).catch(() => null))
      )).filter(Boolean);
      renderStats(me, progress, writers.length);
      renderFollowing(writers);
    }
    if (followIds === null) renderStats(me, progress, '—');

    $('following-grid').addEventListener('click', event => {
      const button = event.target.closest('.btn-unfollow');
      if (button) unfollow(button);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();