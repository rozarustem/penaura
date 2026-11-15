document.addEventListener('DOMContentLoaded', async function() {
    const container = document.getElementById('my-books-container');
    if (!container) return;

    const currentUser = Storage.getCurrentUser();

    if (!currentUser) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4.5rem 1.5rem; background: var(--card-bg, #F1EBDF); border-radius: var(--radius, 0.25rem); border: 1px dashed var(--line, #E4DDD0);">
          <div style="font-size: 2.5rem; margin-bottom: 0.8rem;">🔒</div>
          <h3 style="font-family: var(--font-display, serif); font-size: 1.5rem; margin-bottom: 0.5rem;">Siz tizimga kirmagansiz</h3>
          <p style="color: var(--espresso-soft, #4A3226); margin-bottom: 1.8rem; max-width: 40ch; margin-left: auto; margin-right: auto;">O'z kitoblaringizni ko'rish va yangi boblar qo'shish uchun profilingizga kiring.</p>
          <a href="signin.html" class="btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; padding: 0.8rem 1.6rem;">Sign In &rarr;</a>
        </div>
      `;
      return;
    }

    let userBooks;
    try {
      const response = await PenauraApi.request('/books/mine/');
      userBooks = (response.results || response).map(book => ({
        ...book,
        author_id: String(book.author.id),
        author_name: book.author.full_name,
        chapters: Array(book.chapters_total || 0),
        likes: book.likes_count,
      }));
    } catch (error) {
      container.textContent = error.message || 'Kitoblarni yuklashda xatolik yuz berdi.';
      return;
    }

    if (userBooks.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4.5rem 1.5rem; background: var(--card-bg, #F1EBDF); border-radius: var(--radius, 0.25rem); border: 1px dashed var(--line, #E4DDD0);">
          <div style="font-size: 2.5rem; margin-bottom: 0.8rem;">📖</div>
          <h3 style="font-family: var(--font-display, serif); font-size: 1.5rem; margin-bottom: 0.5rem;">Hali birorta kitob yozmagansiz</h3>
          <p style="color: var(--espresso-soft, #4A3226); margin-bottom: 1.8rem; max-width: 44ch; margin-left: auto; margin-right: auto;">O'z g'oyalaringizni qog'ozga tushiring va o'quvchilaringiz bilan birinchi hikoyangizni ulashing!</p>
          <a href="upload.html" class="btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; padding: 0.8rem 1.6rem;">+ Birinchi Kitobni Boshlash</a>
        </div>
      `;
      return;
    }

    let html = '';
    userBooks.forEach(book => {
      const chaptersCount = book.chapters_total || (book.chapters || []).length;
      const coverUrl = PenauraDOM.getSafeImageUrl(book.cover);
      const coverContent = coverUrl
        ? `<img class="book-cover-image" src="${PenauraDOM.escapeHtml(coverUrl)}" alt="${PenauraDOM.escapeHtml(book.title)} cover" loading="lazy">`
        : '<span class="book-cover-placeholder">cover image</span>';
      const isDraft = book.status === 'draft';
      const statusText = isDraft ? 'DRAFT' : 'ONGOING';
      const statusClass = isDraft ? 'status-badge draft' : 'status-badge';

      html += `
        <a class="book-card" href="manage-book.html?book=${encodeURIComponent(book.slug)}">
          <div class="book-cover">
            <span class="${statusClass}">${statusText}</span>
            ${coverContent}
          </div>
          <div class="book-genre">${PenauraDOM.escapeHtml((book.genre || 'GENERAL').toUpperCase())}</div>
          <h3>${PenauraDOM.escapeHtml(book.title)}</h3>
          <div class="book-meta">${chaptersCount} chapters &bull; ${book.views || 0} views &bull; ${book.likes || 0} likes</div>
          <div class="book-manage-btn">Manage Book &rarr;</div>
        </a>
      `;
    });

    html += `
      <a class="book-card new-book-card" href="upload.html">
        <div class="book-cover">
          <span class="plus">+</span>
          Start a new book
        </div>
        <h3>New Book</h3>
        <div class="book-meta">Set up title, genre and cover</div>
        <div class="book-manage-btn">Get Started &rarr;</div>
      </a>
    `;

    container.innerHTML = html;
  });
