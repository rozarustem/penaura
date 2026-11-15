/**
 * ============================================================
 *  Penaura — Auth & Global Navigation Router (js/auth-nav.js)
 *  1. Navbar Auth holati (Sign In <-> Avatar + Ism + Chiqish)
 *  2. "Start writing" havolalarini yo'naltirish (upload.html yoki signup.html)
 *  3. Header menyu havolalarini to'g'irlash (#discover -> index.html#discover va h.k.)
 *  4. Logo bosilganda bosh sahifaga (index.html) o'tish
 *  5. Qidiruv (search) tugmasini index.html#discover ga ulash
 *  6. Footer va boshqa statik havolalarni haqiqiy sahifalarga bog'lash
 * ============================================================
 */

(function() {
  function initAuthNav() {
    if (typeof Storage === 'undefined') {
      console.warn('[Penaura] Storage topilmadi. storage.js avval ulanishi kerak.');
      return;
    }

    const currentUser = Storage.getCurrentUser();
    const isWriter = currentUser && currentUser.role === 'writer';
    const profileUrl = isWriter ? 'writer_profil.html' : 'reader_profil.html';
    const writeTargetUrl = currentUser ? 'upload.html' : 'signup.html';

    // 1. Logo bosilganda index.html ga o'tish
    const logos = document.querySelectorAll('.logo, .nav-logo');
    logos.forEach(logo => {
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', function(e) {
        // Agar link ichida bo'lmasa
        if (logo.tagName.toLowerCase() !== 'a') {
          window.location.href = 'index.html';
        }
      });
    });

    // 2. Navbar havolalarini to'g'irlash (#discover -> index.html#discover va boshqalar)
    const navLinksMap = {
      '#discover' : 'index.html',
      '#fiction'  : 'fiction.html',
      '#poetry'   : 'poem.html',
      '#poem'     : 'poem.html',
      '#blog'     : 'blog.html',
      '#about'    : 'about.html',
      '#coins'    : 'coins.html',
      '#settings' : 'settings.html',
    };

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    document.querySelectorAll('header nav a, .nav-inner a, .nav a').forEach(a => {
      const href = a.getAttribute('href');
      let normalizedHref = href || '';

      if (href && navLinksMap[href]) {
        normalizedHref = navLinksMap[href];
        a.setAttribute('href', normalizedHref);
      } else {
        const text = a.textContent.trim().toLowerCase();
        if (text === 'discover') {
          normalizedHref = 'index.html';
          a.setAttribute('href', normalizedHref);
        }
        else if (text === 'fiction') {
          normalizedHref = 'fiction.html';
          a.setAttribute('href', normalizedHref);
        }
        else if (text === 'poetry' || text === "she'riyat") {
          normalizedHref = 'poem.html';
          a.setAttribute('href', normalizedHref);
        }
        else if (text === 'blog') {
          normalizedHref = 'blog.html';
          a.setAttribute('href', normalizedHref);
        }
        else if (text === 'about' || text === 'haqida') {
          normalizedHref = 'about.html';
          a.setAttribute('href', normalizedHref);
        }
        else if (text === 'coins') {
          normalizedHref = 'coins.html';
          a.setAttribute('href', normalizedHref);
        }
        else if (text === 'my books' || text === 'kitoblarim') {
          normalizedHref = 'my-books.html';
          a.setAttribute('href', normalizedHref);
        }
      }

      const normalizedCurrentPath = currentPath.replace(/\\/g, '/');
      const targetPath = normalizedHref.split('#')[0].split('?')[0].replace(/\\/g, '/');
      const isCurrentPage = (
        targetPath === normalizedCurrentPath ||
        (targetPath === '' && normalizedCurrentPath === 'index.html') ||
        (targetPath === 'index.html' && normalizedCurrentPath === 'index.html') ||
        (targetPath === 'index.html' && normalizedCurrentPath === '')
      );

      if (isCurrentPage) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });

    // 3. Qidiruv (Search) tugmasi
    document.querySelectorAll('.search-link, .nav-search').forEach(s => {
      s.style.cursor = 'pointer';
      s.setAttribute('role', 'button');
      s.setAttribute('tabindex', '0');
      s.setAttribute('aria-expanded', 'false');

      const navRight = s.closest('.nav-right');
      if (!navRight) return;

      const form = document.createElement('form');
      form.className = 'nav-search-form';
      form.setAttribute('role', 'search');
      form.hidden = true;

      const input = document.createElement('input');
      input.className = 'nav-search-input';
      input.type = 'search';
      input.name = 'search';
      input.placeholder = 'Book title';
      input.setAttribute('aria-label', 'Search by book title');
      input.autocomplete = 'off';

      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.textContent = 'Go';
      submit.setAttribute('aria-label', 'Search books');

      form.append(input, submit);
      navRight.appendChild(form);

      const initialQuery = new URLSearchParams(window.location.search).get('search');
      if (initialQuery) {
        form.hidden = false;
        input.value = initialQuery;
        s.setAttribute('aria-expanded', 'true');
      }

      const openSearch = () => {
        form.hidden = false;
        s.setAttribute('aria-expanded', 'true');
        input.focus();
      };

      s.addEventListener('click', openSearch);
      s.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSearch();
        }
      });

      input.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
          form.hidden = true;
          s.setAttribute('aria-expanded', 'false');
          s.focus();
        }
      });

      form.addEventListener('submit', function(event) {
        event.preventDefault();
        const query = input.value.trim();
        if (!query) {
          window.location.href = 'index.html#discover';
          return;
        }
        window.location.href = `index.html?search=${encodeURIComponent(query)}#discover`;
      });
    });

    // Bildirishnomalar (qo'ng'iroqcha): kuzatilgan yozuvchi yangi bob/kitob chiqarganda
    function buildNotificationBell() {
      if (!window.PenauraApi || !PenauraApi.getAccessToken()) return null;

      const wrap = document.createElement('div');
      wrap.className = 'auth-bell';
      wrap.style.cssText = 'position:relative; display:inline-flex; align-items:center;';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'auth-bell-btn';
      btn.title = 'Bildirishnomalar';
      btn.setAttribute('aria-label', 'Notifications');
      btn.style.cssText = 'position:relative; background:none; border:none; cursor:pointer; ' +
        'padding:0.3rem 0.4rem; color:var(--espresso, #2C1810); display:inline-flex; align-items:center;';
      btn.innerHTML =
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>' +
        '<path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>';

      const badge = document.createElement('span');
      badge.style.cssText = 'position:absolute; top:-2px; right:-2px; min-width:16px; height:16px; ' +
        'padding:0 4px; border-radius:8px; background:var(--terracotta, #B5622E); color:#FAF8F4; ' +
        'font-size:10px; line-height:16px; text-align:center; display:none;';
      btn.appendChild(badge);

      const panel = document.createElement('div');
      panel.style.cssText = 'position:absolute; right:0; top:calc(100% + 8px); width:320px; max-width:90vw; ' +
        'max-height:420px; overflow:auto; background:var(--cream, #FAF8F4); color:var(--espresso, #2C1810); ' +
        'border:1px solid rgba(44,24,16,0.15); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.12); ' +
        'z-index:1000; display:none; text-align:left;';

      wrap.append(btn, panel);

      function setUnread(count) {
        const n = Number(count) || 0;
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.style.display = n > 0 ? 'inline-block' : 'none';
      }

      function timeAgo(iso) {
        const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
        if (sec < 60) return 'hozirgina';
        if (sec < 3600) return Math.floor(sec / 60) + ' daqiqa oldin';
        if (sec < 86400) return Math.floor(sec / 3600) + ' soat oldin';
        return Math.floor(sec / 86400) + ' kun oldin';
      }

      function render(rows) {
        panel.replaceChildren();
        if (!rows.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:1rem; font-size:0.9rem; opacity:0.7;';
          empty.textContent = "Hozircha xabar yo'q. Yozuvchilarni kuzating, yangi bob chiqsa shu yerda ko'rasiz.";
          panel.appendChild(empty);
          return;
        }
        rows.forEach(row => {
          const item = document.createElement('div');
          item.style.cssText = 'padding:0.7rem 1rem; border-bottom:1px solid rgba(44,24,16,0.08); ' +
            'cursor:' + (row.url ? 'pointer' : 'default') + '; font-size:0.9rem; line-height:1.35; ' +
            (row.is_read ? '' : 'background:rgba(181,98,46,0.10);');
          const text = document.createElement('div');
          text.textContent = row.message;
          const when = document.createElement('div');
          when.style.cssText = 'font-size:0.75rem; opacity:0.6; margin-top:0.2rem;';
          when.textContent = timeAgo(row.created_at);
          item.append(text, when);
          if (row.url) item.addEventListener('click', () => { window.location.href = row.url; });
          panel.appendChild(item);
        });
      }

      async function refreshCount() {
        try {
          const data = await PenauraApi.request('/auth/notifications/');
          setUnread(data.unread);
          return data;
        } catch (e) { return null; }
      }

      async function openPanel() {
        panel.style.display = 'block';
        const data = await refreshCount();
        if (!data) return;
        render(data.results || []);
        if (data.unread > 0) {
          try {
            await PenauraApi.request('/auth/notifications/read/', { method: 'POST', body: {} });
            setUnread(0);
          } catch (e) { /* keyingi ochilishda qayta uriniladi */ }
        }
      }

      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (panel.style.display === 'block') panel.style.display = 'none';
        else openPanel();
      });
      document.addEventListener('click', e => { if (!wrap.contains(e.target)) panel.style.display = 'none'; });

      refreshCount();
      setInterval(() => { if (!document.hidden) refreshCount(); }, 60000);
      return wrap;
    }

    // 4. "Sign In" tugmalarini yangilash
    const signinButtons = document.querySelectorAll('.btn-signin');
    signinButtons.forEach(btn => {
      if (!currentUser) {
        if (btn.tagName.toLowerCase() === 'button') {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'signin.html';
          });
        } else if (btn.tagName.toLowerCase() === 'a') {
          btn.setAttribute('href', 'signin.html');
        }
      } else {
        const firstLetter = (currentUser.name && currentUser.name.charAt(0)) ? currentUser.name.charAt(0).toUpperCase() : 'U';
        const firstName = String(currentUser.name || '').trim().split(/\s+/)[0] || 'User';
        const container = document.createElement('div');
        container.className = 'auth-user-container';

        const profileLink = document.createElement('a');
        profileLink.href = profileUrl;
        profileLink.className = 'auth-profile-link';

        const avatar = document.createElement('span');
        avatar.className = 'auth-profile-avatar';
        avatar.textContent = firstLetter;

        const name = document.createElement('span');
        name.className = 'auth-profile-name';
        name.textContent = firstName;
        profileLink.append(avatar, name);

        const savedLink = document.createElement('a');
        savedLink.href = 'saved.html';
        savedLink.className = 'auth-saved-link';
        savedLink.title = 'Saqlanganlar';
        savedLink.setAttribute('aria-label', 'Saved');
        const onSavedPage = currentPath === 'saved.html';
        savedLink.innerHTML =
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="' + (onSavedPage ? 'currentColor' : 'none') + '" ' +
          'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<polygon points="20 21 12 14 4 21 4 3 20 3 20 21"></polygon></svg>';
        savedLink.style.cssText = 'display:inline-flex; align-items:center; padding:0.3rem 0.4rem; ' +
          'color:var(--espresso, #2C1810); text-decoration:none;';

        const bell = buildNotificationBell();
        if (bell) container.append(profileLink, bell, savedLink);
        else container.append(profileLink, savedLink);
        btn.parentNode.replaceChild(container, btn);
      }
    });

    // 5. "Start writing" tugmalari
    document.querySelectorAll('a, button').forEach(el => {
      const text = el.textContent.trim().toLowerCase();
      if (text.includes('start writing') || text.includes('yozishni boshlash')) {
        if (el.tagName.toLowerCase() === 'a') {
          el.setAttribute('href', writeTargetUrl);
        } else {
          el.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = writeTargetUrl;
          });
        }
      }
    });

    // 6. Footer va boshqa href="#" havolalarni to'g'irlash
    const footerLinkMap = {
      'fiction': 'fiction.html',
      'poetry': 'poem.html',
      'she\'riyat': 'poem.html',
      'essays': 'index.html#discover',
      'non-fiction': 'index.html#discover',
      'start writing': writeTargetUrl,
      'writer tips': 'blog.html?cat=tips',
      'publishing guide': 'blog.html?cat=guide',
      'workshops': 'blog.html?cat=community',
      'literary fiction': 'fiction.html?sub=literary',
      'romance': 'index.html#discover',
      'mystery': 'index.html#discover',
      'sci-fi': 'index.html#discover',
      'about penaura': 'about.html',
      'about': 'about.html',
      'careers': 'about.html',
      'contact': 'about.html',
      'terms': 'about.html',
      'settings': 'settings.html',
      'coins': 'coins.html',
      'my books': 'my-books.html',
    };

    document.querySelectorAll('footer a, .footer-col a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === '#' || !href || href === '') {
        const text = a.textContent.trim().toLowerCase();
        if (footerLinkMap[text]) {
          a.setAttribute('href', footerLinkMap[text]);
        } else {
          a.setAttribute('href', 'index.html#discover');
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthNav);
  } else {
    initAuthNav();
  }
})();