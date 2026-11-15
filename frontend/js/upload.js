document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('upload-book-form');
    uploadForm.addEventListener('submit', function(event) {
      event.preventDefault();
    });

    // Faqat Writer hisobi kitob va she'r yoza oladi (backend ham boshqalarga 403 qaytaradi)
    const sessionUser = Storage.getCurrentUser();
    if (!sessionUser) { window.location.href = 'signin.html'; return; }
    if (sessionUser.role !== 'writer') {
      document.getElementById('upload-heading').textContent = 'Faqat yozuvchilar uchun';
      document.getElementById('upload-intro').textContent =
        "Kitob va she'r yozish faqat Writer hisobi bilan mumkin. Sizning hisobingiz yozuvchi emas.";
      const layout = document.querySelector('.upload-layout');
      const notice = document.createElement('div');
      notice.style.cssText = 'grid-column: 1 / -1; padding: 2rem 0 4rem; display: flex; flex-wrap: wrap; gap: 0.8rem;';
      [['signup.html', 'Writer hisobini yaratish', true], ['index.html', 'Bosh sahifaga qaytish', false]]
        .forEach(function(item) {
          const link = document.createElement('a');
          link.href = item[0];
          link.textContent = item[1];
          link.style.cssText = 'display:inline-block; text-decoration:none; padding:0.65rem 1.4rem; border-radius:var(--radius, 4px); ' +
            'border:1px solid var(--terracotta, #B5622E); ' +
            (item[2] ? 'background:var(--terracotta, #B5622E); color:#FAF8F4;' : 'color:var(--terracotta, #B5622E);');
          notice.appendChild(link);
        });
      layout.replaceChildren(notice);
      return;
    }
    const alertBox = document.getElementById('upload-alert');
    const titleInput = document.getElementById('book-title');
    const genreSelect = document.getElementById('book-genre');
    const poemTopicGroup = document.getElementById('poem-topic-group');
    const poemTopicSelect = document.getElementById('poem-topic');
    const creationTypeInputs = document.querySelectorAll('input[name="creation-type"]');
    const genreGroup = document.getElementById('book-genre-group');
    const descriptionGroup = document.getElementById('book-description-group');
    const singleChapterFields = document.getElementById('single-chapter-fields');
    const singleChapterTitle = document.getElementById('single-chapter-title');
    const singleChapterContent = document.getElementById('single-chapter-content');
    const descriptionLabel = document.getElementById('description-label');
    const titleLabel = document.getElementById('book-title-label');
      const uploadHeading = document.getElementById('upload-heading');
    const introText = document.getElementById('upload-intro');
    const statusDescription = document.getElementById('status-description');
    const languageSelect = document.getElementById('book-language');
    const descriptionInput = document.getElementById('book-description');
    const tagInput = document.getElementById('book-tags-input');
    const tagContainer = document.getElementById('tag-container');
    const coverInput = document.getElementById('book-cover');
    const coverPreview = document.getElementById('cover-img-preview');
    const coverWrapper = document.getElementById('cover-preview-wrapper');
    const btnContinue = document.getElementById('btn-continue');
    const btnSaveDraft = document.getElementById('btn-save-draft');
    const coverSidebar = document.getElementById('cover-sidebar-box');

    let coverDataUrl = '';
    let tagsList = [];

    function updateCreateMode() {
      const selectedType = document.querySelector('input[name="creation-type"]:checked').value;
      const poetryMode = selectedType === 'poem';
      const chapteredMode = selectedType === 'chaptered';
      const singleStoryMode = selectedType === 'single';
      document.body.classList.toggle('poem-upload-mode', poetryMode);
      document.body.classList.toggle('chaptered-book-mode', chapteredMode);
      document.body.classList.toggle('single-story-mode', singleStoryMode);
      poemTopicGroup.hidden = !poetryMode;
      genreGroup.hidden = poetryMode;
      descriptionGroup.hidden = singleStoryMode;
      singleChapterFields.hidden = !singleStoryMode;
      coverSidebar.hidden = poetryMode;
      titleLabel.textContent = poetryMode ? 'POEM TITLE' : chapteredMode ? 'BOOK TITLE' : 'STORY TITLE';
      uploadHeading.textContent = poetryMode
        ? 'Write a New Poem'
        : singleStoryMode ? 'Write a Short Story' : 'Start a New Book';
      introText.textContent = poetryMode
        ? 'Write and publish a poem directly — no chapters needed.'
        : singleStoryMode
          ? 'Write the complete story in one part and publish it as a finished work.'
          : "Set up your book's details first — you'll add chapters one by one from the book's page.";
      descriptionLabel.textContent = poetryMode ? 'POEM TEXT' : 'SHORT DESCRIPTION';
      titleInput.placeholder = poetryMode
        ? 'Give your poem a title'
        : chapteredMode ? 'Give your book a title' : 'Give your story a title';
      descriptionInput.placeholder = poetryMode
        ? 'Write your poem here...'
        : 'Write a short, compelling description that makes readers want to click...';
      descriptionInput.rows = poetryMode ? 10 : 5;
      singleChapterTitle.required = singleStoryMode;
      singleChapterContent.required = singleStoryMode;
      descriptionInput.required = !singleStoryMode;
      const isDraftSelected = document.querySelector('#status-draft').checked;
      statusDescription.textContent = poetryMode
        ? 'Choose whether to publish your poem now or keep it as a draft.'
        : singleStoryMode
          ? 'Choose whether to publish your complete story or save it as a draft.'
          : 'Choose your book visibility.';
      btnContinue.textContent = poetryMode
        ? (isDraftSelected ? 'Save Poem Draft' : 'Publish Poem →')
        : singleStoryMode
          ? (isDraftSelected ? 'Save Story Draft' : 'Publish Story →')
          : 'Continue to Add Chapters →';
      btnSaveDraft.hidden = !chapteredMode;
    }

    creationTypeInputs.forEach(input => input.addEventListener('change', updateCreateMode));
    document.querySelectorAll('input[name="status"]').forEach(input => {
      input.addEventListener('change', updateCreateMode);
    });
    updateCreateMode();

    function showAlert(message, isSuccess = false) {
      alertBox.style.display = 'block';
      if (isSuccess) {
        alertBox.style.background = 'rgba(74, 150, 96, 0.15)';
        alertBox.style.color = '#2d6a4f';
        alertBox.style.border = '1px solid #74c69d';
      } else {
        alertBox.style.background = 'rgba(181, 98, 46, 0.15)';
        alertBox.style.color = 'var(--terracotta)';
        alertBox.style.border = '1px solid var(--terracotta-soft)';
      }
      alertBox.textContent = message;
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideAlert() {
      alertBox.style.display = 'none';
      alertBox.textContent = '';
    }

    // 1. Tags rendering and management
    function renderTags() {
      // Remove old chips
      const chips = tagContainer.querySelectorAll('.tag-chip');
      chips.forEach(c => c.remove());

      tagsList.forEach((tag, idx) => {
        const span = document.createElement('span');
        span.className = 'tag-chip';
        span.innerHTML = `${PenauraDOM.escapeHtml(tag)} <span style="cursor:pointer;margin-left:4px;" data-idx="${idx}">×</span>`;
        tagContainer.insertBefore(span, tagInput);

        span.querySelector('span').addEventListener('click', function() {
          const i = parseInt(this.getAttribute('data-idx'));
          tagsList.splice(i, 1);
          renderTags();
        });
      });
    }

    tagInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = tagInput.value.trim().replace(/^,|,$/g, '');
        if (val && !tagsList.includes(val)) {
          tagsList.push(val);
          renderTags();
          tagInput.value = '';
        }
      }
    });

    renderTags();

    // 2. Cover image upload & preview
    coverInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          showAlert('Iltimos, rasm formatidagi fayl tanlang.');
          return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
          coverDataUrl = evt.target.result;
          coverPreview.src = coverDataUrl;
          coverPreview.style.display = 'block';
          coverWrapper.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    });

    // 3. Save Book Logic
    async function handleSaveBook(isDraft) {
      hideAlert();

      const currentUser = Storage.getCurrentUser();
      if (!currentUser) {
        showAlert('Kitob yaratish uchun avval tizimga kiring. Kirish sahifasiga yo\'naltirilmoqda...');
        setTimeout(function() {
          window.location.href = 'signin.html';
        }, 1500);
        return;
      }

      const title = titleInput.value.trim();
      const creationType = document.querySelector('input[name="creation-type"]:checked').value;
      const poetryMode = creationType === 'poem';
      const singleStoryMode = creationType === 'single';
      const genre = genreSelect.value;
      const language = languageSelect.value;
      const description = descriptionInput.value.trim();
      const chapterTitle = singleChapterTitle.value.trim();
      const chapterContent = singleChapterContent.value.trim();
      const statusRadio = document.querySelector('input[name="status"]:checked');
      const status = isDraft ? 'draft' : (statusRadio ? statusRadio.value : 'published');
      const apiStatus = status === 'draft' ? 'draft' : 'submitted';

      if (!title) {
        showAlert(poetryMode
          ? 'Iltimos, she’r sarlavhasini kiriting.'
          : singleStoryMode ? 'Iltimos, hikoya sarlavhasini kiriting.' : 'Iltimos, kitob sarlavhasini kiriting.');
        titleInput.focus();
        return;
      }

      if (poetryMode && !description) {
        showAlert('Iltimos, she’r matnini yozing.');
        descriptionInput.focus();
        return;
      }

      if (singleStoryMode && !chapterTitle) {
        showAlert('Iltimos, hikoya sarlavhasini kiriting.');
        singleChapterTitle.focus();
        return;
      }

      if (singleStoryMode && !chapterContent) {
        showAlert('Iltimos, hikoya matnini yozing.');
        singleChapterContent.focus();
        return;
      }

      if (!poetryMode && !singleStoryMode && !description) {
        showAlert('Iltimos, kitob haqida qisqacha tavsif yozing.');
        descriptionInput.focus();
        return;
      }

      if (poetryMode) {
        const topic = poemTopicSelect.value;
        const topicLabel = poemTopicSelect.options[poemTopicSelect.selectedIndex].text;
        const excerpt = description.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 2).join('\n');

        try {
          await PenauraApi.request('/poems/', {
            method: 'POST',
            body: {
              title, content: description, excerpt, topic,
              genre: topicLabel.toUpperCase(), tags: tagsList, status: apiStatus,
            },
          });
          showAlert(status === 'draft' ? 'She’r qoralama sifatida saqlandi.' : 'She’r tahririyatga yuborildi. Tahrirchi nashr qilgach, She’riyat sahifasida chiqadi.', true);
          setTimeout(function() {
            window.location.href = 'writer_profil.html';
          }, 800);
        } catch (err) {
          console.error(err);
          showAlert('She’rni saqlashda xatolik yuz berdi: ' + err.message);
        }
        return;
      }

      const newBook = {
        title: title,
        genre: genre,
        language: language,
        description: singleStoryMode
          ? chapterContent.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 2).join(' ').slice(0, 240)
          : description,
        tags: [...tagsList],
        cover: coverDataUrl || '',
        author_id: currentUser.id,
        status: status,
        format: creationType,
        views: 0,
        likes: 0,
        chapters: []
      };

      try {
        const bookForm = new FormData();
        bookForm.append('title', newBook.title);
        bookForm.append('genre', newBook.genre);
        bookForm.append('language', newBook.language);
        bookForm.append('description', newBook.description);
        bookForm.append('tags', JSON.stringify(newBook.tags));
        const coverFile = coverInput.files && coverInput.files[0];
        if (coverFile) bookForm.append('cover', coverFile);
        const savedBook = await PenauraApi.request('/books/', {
          method: 'POST', body: bookForm,
        });
        if (singleStoryMode) {
          await PenauraApi.request(`/books/${encodeURIComponent(savedBook.slug)}/chapters/`, {
            method: 'POST',
            body: { title: chapterTitle, content: chapterContent, status: apiStatus },
          });
        }

        showAlert(singleStoryMode
          ? 'Hikoya tahririyatga yuborildi!'
          : 'Kitob saqlandi! Boblar sahifasiga yo\'naltirilmoqda...', true);

        setTimeout(function() {
          window.location.href = 'manage-book.html?book=' + encodeURIComponent(savedBook.slug);
        }, 800);
      } catch (err) {
        console.error(err);
        showAlert('Xatolik yuz berdi: ' + err.message);
      }
    }

    if (btnContinue) {
      btnContinue.addEventListener('click', function() {
        handleSaveBook(false);
      });
    }

    if (btnSaveDraft) {
      btnSaveDraft.addEventListener('click', function() {
        handleSaveBook(true);
      });
    }
  });