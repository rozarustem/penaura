document.addEventListener('DOMContentLoaded', async function() {
    const notFoundBox = document.getElementById('chapter-not-found');
    const mainSection = document.getElementById('editor-main-section');
    const breadcrumb = document.getElementById('chapter-breadcrumb');
    const titleInput = document.getElementById('chapter-title-input');
    const editorBody = document.getElementById('chapter-editor-body');
    const statChapterNum = document.getElementById('stat-chapter-num');
    const statWordCount = document.getElementById('stat-word-count');
    const statLastSaved = document.getElementById('stat-last-saved');

    // "2026-10-16T10:00:00Z" -> "2026-10-16 15:00" (mahalliy vaqt)
    function formatTime(value) {
      const date = new Date(value);
      if (!value || isNaN(date)) return value || 'Recent';
      const pad = n => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    const accessFree = document.getElementById('access-free');
    const accessPremium = document.getElementById('access-premium');
    const pubDraft = document.getElementById('pub-status-draft');
    const pubPublished = document.getElementById('pub-status-published');
    const btnPublish = document.getElementById('btn-publish-chapter');
    const btnSaveDraft = document.getElementById('btn-save-draft');
    const saveIcon = document.getElementById('save-icon');
    const saveText = document.getElementById('save-text');

    /* Bobning haqiqiy holati yozuvchiga ko'rinib turadi (radio tugmalar faqat yuborish tanlovi). */
    const STATUS_INFO = {
      draft: ['Qoralama', 'Tahririyatga yuborilmagan. Yuborish uchun «Publish Chapter» ni bosing.'],
      submitted: ['Tahririyatga yuborilgan', 'Navbatda: tahrirchi hali ko\'rib chiqishni boshlamagan.'],
      editing: ['Tahrirchi ko\'rib chiqmoqda', 'Bob hozir tahrirda. Tahrirchi tugatguncha kuting.'],
      published: ['Saytda nashr qilingan', 'Matnni o\'zgartirsangiz, bob qayta tahririyatga yuboriladi.'],
      returned: ['Tahrirchi qaytardi', 'Izohni o\'qib tuzating va «Publish Chapter» bilan qayta yuboring.'],
    };
    const statusBox = document.getElementById('chapter-status');
    const statusLabel = document.getElementById('chapter-status-label');
    const statusNote = document.getElementById('chapter-status-note');

    function renderChapterStatus(status, editorNote) {
      if (!statusBox || !statusLabel || !statusNote) return;
      const info = STATUS_INFO[status] || STATUS_INFO.draft;
      statusBox.hidden = false;
      statusBox.dataset.state = STATUS_INFO[status] ? status : 'draft';
      statusLabel.textContent = 'Holati: ' + info[0];
      // textContent: tahrirchi izohi matn sifatida ko'rsatiladi (HTML sifatida emas)
      statusNote.textContent = status === 'returned' && editorNote
        ? 'Tahrirchi izohi: ' + editorNote
        : info[1];
    }

    function setSaveStatus(text, color = '#2d6a4f') {
      if (saveText) saveText.textContent = text;
      if (saveIcon) saveIcon.style.color = color;
      setTimeout(function() {
        if (saveText) saveText.textContent = 'All changes saved';
        if (saveIcon) saveIcon.style.color = '#74c69d';
      }, 3000);
    }

    function updateWordCount() {
      if (!editorBody || !statWordCount) return;
      const text = editorBody.innerText || editorBody.textContent || '';
      const words = text.trim().split(/\s+/).filter(Boolean);
      statWordCount.textContent = `${words.length} words`;
    }

    // 1. URL params: ?book=<slug>&chapter=<id>
    const urlParams = new URLSearchParams(window.location.search);
    const bookSlug = urlParams.get('book');
    const chapterId = urlParams.get('chapter');

    if (!bookSlug) {
      if (notFoundBox) notFoundBox.style.display = 'block';
      if (mainSection) mainSection.style.display = 'none';
      return;
    }

    let book;
    let chapter;
    let chapters;
    try {
      book = await PenauraApi.request(`/books/${encodeURIComponent(bookSlug)}/`);
      chapters = book.chapters || [];
      chapter = await PenauraApi.request(
        `/books/${encodeURIComponent(bookSlug)}/chapters/${encodeURIComponent(chapterId)}/`
      );
    } catch (error) {
      if (notFoundBox) notFoundBox.style.display = 'block';
      if (mainSection) mainSection.style.display = 'none';
      return;
    }

    const chapterIndex = chapters.findIndex(c => String(c.id) === String(chapterId));

    // 2. Populate form fields
    if (breadcrumb) {
      breadcrumb.href = `manage-book.html?book=${encodeURIComponent(book.slug)}`;
      breadcrumb.textContent = `← ${book.title}`;
    }

    if (titleInput) {
      titleInput.value = chapter.title || '';
    }

    if (editorBody) {
      if (chapter.content && chapter.content.trim()) {
        const content = /<p(?:\s|>)/i.test(chapter.content)
          ? chapter.content
          : `<p>${PenauraDOM.escapeHtml(chapter.content).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        editorBody.replaceChildren(PenauraDOM.createSafeRichText(content));
      } else {
        const emptyParagraph = document.createElement('p');
        emptyParagraph.textContent = 'Start writing, or paste in your chapter text here...';
        editorBody.replaceChildren(emptyParagraph);
      }
    }

    if (statChapterNum) {
      statChapterNum.textContent = `${chapterIndex + 1} of ${chapters.length}`;
    }

    if (chapter.is_premium && accessPremium) {
      accessPremium.checked = true;
    } else if (accessFree) {
      accessFree.checked = true;
    }

    // Tahririyatga yuborilgan (submitted/editing) bob ham "Published" tarafda ko'rinadi
    if (['published', 'submitted', 'editing'].includes(chapter.status) && pubPublished) {
      pubPublished.checked = true;
    } else if (pubDraft) {
      pubDraft.checked = true;
    }

    renderChapterStatus(chapter.status, chapter.editor_note);

    if (statLastSaved) {
      statLastSaved.textContent = formatTime(chapter.updated_at || chapter.created_at);
    }

    updateWordCount();

    // 3. Toolbar actions
    const toolbarButtons = document.querySelectorAll('.editor-toolbar button');
    toolbarButtons.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const cmd = this.getAttribute('data-cmd');
        const val = this.getAttribute('data-val') || null;
        document.execCommand(cmd, false, val);
        editorBody.focus();
      });
    });

    // Listen to changes for word count
    editorBody.addEventListener('paste', function(event) {
      const clipboard = event.clipboardData;
      if (!clipboard) return;

      const html = clipboard.getData('text/html');
      const plainText = clipboard.getData('text/plain');
      if (!html && !plainText) return;

      event.preventDefault();
      const pastedContent = html || `<p>${PenauraDOM.escapeHtml(plainText).replace(/\r?\n/g, '<br>')}</p>`;
      const fragment = PenauraDOM.createSafeRichText(pastedContent);
      const safeMarkup = document.createElement('div');
      safeMarkup.replaceChildren(fragment);
      editorBody.focus();
      document.execCommand('insertHTML', false, safeMarkup.innerHTML);
      editorBody.dispatchEvent(new Event('input', { bubbles: true }));
    });

    editorBody.addEventListener('input', function() {
      updateWordCount();
      if (saveText) saveText.textContent = 'Unsaved changes...';
      if (saveIcon) saveIcon.style.color = 'var(--terracotta)';
    });

    titleInput.addEventListener('input', function() {
      if (saveText) saveText.textContent = 'Unsaved changes...';
      if (saveIcon) saveIcon.style.color = 'var(--terracotta)';
    });

    // 4. Save Logic
    async function saveChapter(isPublish) {
      const newTitle = titleInput.value.trim();
      const sanitizedContent = document.createElement('div');
      sanitizedContent.replaceChildren(PenauraDOM.createSafeRichText(editorBody.innerHTML));
      const newContent = sanitizedContent.innerHTML;
      const isPrem = accessPremium ? accessPremium.checked : false;
      const newStatus = isPublish || (pubPublished && pubPublished.checked) ? 'submitted' : 'draft';

      if (!newTitle) {
        alert('Iltimos, bob sarlavhasini kiriting.');
        titleInput.focus();
        return;
      }

      try {
        const saved = await PenauraApi.request(
          `/books/${encodeURIComponent(bookSlug)}/chapters/${encodeURIComponent(chapter.id)}/`,
          {
            method: 'PATCH',
            body: {
              title: newTitle, content: newContent, is_premium: isPrem, status: newStatus,
            },
          }
        );
        chapter.title = saved.title;
        chapter.content = saved.content;
        chapter.is_premium = saved.is_premium;
        chapter.status = saved.status;
        chapter.editor_note = saved.editor_note;
        renderChapterStatus(saved.status, saved.editor_note);
        if (statLastSaved) statLastSaved.textContent = formatTime(saved.updated_at);
        if (newStatus === 'submitted' && pubPublished) pubPublished.checked = true;
        setSaveStatus(newStatus === 'submitted' ? 'Tahririyatga yuborildi ✓' : 'Saqlandi ✓', '#2d6a4f');
      } catch (error) {
        alert(error.message || 'Saqlashda xatolik yuz berdi.');
      }
    }

    if (btnSaveDraft) {
      btnSaveDraft.addEventListener('click', function() {
        saveChapter(false);
      });
    }

    if (btnPublish) {
      btnPublish.addEventListener('click', function() {
        saveChapter(true);
      });
    }

    // Ctrl+S / Cmd+S shortcut to save
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveChapter(false);
      }
    });
  });