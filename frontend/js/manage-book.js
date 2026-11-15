document.addEventListener("DOMContentLoaded", async function() {
    const notFoundBox = document.getElementById("book-not-found");
    const contentWrapper = document.getElementById("book-content-wrapper");
    const coverEl = document.getElementById("manage-book-cover");
    const genreEl = document.getElementById("manage-book-genre");
    const titleEl = document.getElementById("manage-book-title");
    const statsEl = document.getElementById("manage-book-stats");
    const chaptersContainer = document.getElementById("chapters-list-container");
    const readerDialog = document.getElementById("chapter-reader-dialog");
    const readerBookTitle = document.getElementById("reader-book-title");
    const readerChapterCounter = document.getElementById("reader-chapter-counter");
    const readerChapterTitle = document.getElementById("reader-chapter-title");
    const readerChapterContent = document.getElementById("reader-chapter-content");
    const readerChapterPosition = document.getElementById("reader-chapter-position");
    const btnReaderClose = document.getElementById("btn-reader-close");
    const btnReaderPrevious = document.getElementById("btn-reader-previous");
    const btnReaderNext = document.getElementById("btn-reader-next");
    const alertBox = document.getElementById("chapter-alert");
    const newTitleInput = document.getElementById("new-chapter-title");
    const newContentInput = document.getElementById("new-chapter-content");
    const btnAddChapter = document.getElementById("btn-add-chapter");
    let activeChapterIndex = 0;

    function showAlert(message, isSuccess) {
      if (!alertBox) return;
      alertBox.style.display = "block";
      if (isSuccess) {
        alertBox.style.background = "rgba(74, 150, 96, 0.15)";
        alertBox.style.color = "#2d6a4f";
        alertBox.style.border = "1px solid #74c69d";
      } else {
        alertBox.style.background = "rgba(181, 98, 46, 0.15)";
        alertBox.style.color = "var(--terracotta)";
        alertBox.style.border = "1px solid var(--terracotta-soft)";
      }
      alertBox.textContent = message;
    }

    function hideAlert() {
      if (!alertBox) return;
      alertBox.style.display = "none";
      alertBox.textContent = "";
    }

    // 1. Get book slug from URL (?book=...)
    const urlParams = new URLSearchParams(window.location.search);
    const bookSlug = urlParams.get("book");

    if (!bookSlug) {
      if (notFoundBox) notFoundBox.style.display = "block";
      if (contentWrapper) contentWrapper.style.display = "none";
      return;
    }

    // Bob qaysi bosqichda ekani yozuvchiga ko'rinib turishi uchun (qoralama tahririyatga o'zi bormaydi).
    const CHAPTER_STATUS_TAGS = {
      draft: ["Draft · not sent to editors", "draft"],
      submitted: ["Sent to editors", "published"],
      editing: ["Being edited", "published"],
      published: ["Published", "published"],
      returned: ["Returned · fix & resend", "draft"],
    };

    let currentBook;
    try {
      const book = await PenauraApi.request(`/books/${encodeURIComponent(bookSlug)}/`);
      const chapterRows = book.chapters || [];
      const chapters = await Promise.all(chapterRows.map(async row => {
        const chapter = await PenauraApi.request(
          `/books/${encodeURIComponent(bookSlug)}/chapters/${row.id}/`
        );
        return {
          ...chapter,
          isPremium: chapter.is_premium,
          createdAt: chapter.created_at,
          updatedAt: chapter.updated_at,
        };
      }));
      currentBook = {
        ...book,
        author_id: String(book.author.id),
        author_name: book.author.full_name,
        likes: book.likes_count,
        chapters,
      };
    } catch (error) {
      if (notFoundBox) notFoundBox.style.display = "block";
      if (contentWrapper) contentWrapper.style.display = "none";
      if (notFoundBox) notFoundBox.dataset.error = error.message;
      return;
    }

    // 2. Render book header details
    function renderBookHeader() {
      if (titleEl) titleEl.textContent = currentBook.title;
      if (genreEl) genreEl.textContent = (currentBook.genre || "GENERAL").toUpperCase();
      
      const chaptersCount = (currentBook.chapters || []).length;
      if (statsEl) {
        statsEl.textContent = `${chaptersCount} chapters · ${currentBook.views || 0} reads · ${currentBook.likes || 0} likes · Status: ${(currentBook.status || "published").toUpperCase()}`;
      }

      if (coverEl) {
        const coverUrl = PenauraDOM.getSafeImageUrl(currentBook.cover);
        if (coverUrl) {
          coverEl.style.backgroundImage = `url("${coverUrl}")`;
          coverEl.style.color = "transparent";
        } else {
          coverEl.style.backgroundImage = "none";
          coverEl.style.color = "inherit";
          coverEl.textContent = "cover";
        }
      }
    }

    function openChapterReader(index) {
      const chapters = currentBook.chapters || [];
      const chapter = chapters[index];
      if (!chapter) return;

      activeChapterIndex = index;
      readerBookTitle.textContent = currentBook.title;
      readerChapterCounter.textContent = `CHAPTER ${index + 1} OF ${chapters.length}`;
      readerChapterTitle.textContent = chapter.title || `Chapter ${index + 1}`;
      readerChapterPosition.textContent = `${index + 1} / ${chapters.length}`;
      btnReaderPrevious.disabled = index === 0;
      btnReaderNext.disabled = index === chapters.length - 1;

      readerChapterContent.replaceChildren(PenauraDOM.createSafeRichText(chapter.content));
      readerDialog.showModal();
    }

    btnReaderClose.addEventListener("click", () => readerDialog.close());
    readerDialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        readerDialog.close();
      }
    });
    btnReaderPrevious.addEventListener("click", () => openChapterReader(activeChapterIndex - 1));
    btnReaderNext.addEventListener("click", () => openChapterReader(activeChapterIndex + 1));

    // 3. Render chapters list
    function renderChapters() {
      renderBookHeader();

      const chapters = currentBook.chapters || [];
      if (chapters.length === 0) {
        chaptersContainer.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; background: var(--card-bg, #F1EBDF); border-radius: var(--radius, 0.25rem); border: 1px dashed var(--line, #E4DDD0); color: var(--espresso-soft, #4A3226);">
            Hali hech qanday bob qo'shilmagan. Quyidagi forma orqali birinchi bobni qo'shing!
          </div>
        `;
        return;
      }

      let html = "";
      chapters.forEach((ch, idx) => {
        const wordsCount = (ch.content || "").split(/\s+/).filter(Boolean).length;
        const tagClass = ch.isPremium ? "status-tag scheduled" : "status-tag published";
        const tagText = ch.isPremium ? "Premium" : "Free";
        const dateStr = PenauraDOM.escapeHtml(ch.updatedAt || ch.createdAt || "Recent");
        const stTag = CHAPTER_STATUS_TAGS[ch.status] || CHAPTER_STATUS_TAGS.draft;

        html += `
          <div class="chapter-row" data-id="${PenauraDOM.escapeHtml(ch.id)}" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid var(--line, #E4DDD0);">
            <button type="button" class="chapter-read-trigger" data-chapter-index="${idx}" aria-label="Read chapter: ${PenauraDOM.escapeHtml(ch.title)}">
              <div class="chapter-num" style="font-family: var(--font-mono, monospace); font-weight: 700; width: 28px; text-align: center;">${idx + 1}</div>
              <div class="chapter-row-info">
                <h4 style="margin: 0 0 0.3rem; font-family: var(--font-display, serif); font-size: 1.05rem;">
                  ${PenauraDOM.escapeHtml(ch.title)} <span class="${tagClass}" style="font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 3px; font-family: var(--font-mono, monospace);">${tagText}</span>
                  <span class="status-tag ${stTag[1]}" style="font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 3px; font-family: var(--font-mono, monospace);">${stTag[0]}</span>
                </h4>
                <div class="meta" style="font-size: 0.8rem; color: var(--espresso-soft, #4A3226); font-family: var(--font-mono, monospace);">
                  ${wordsCount} words · ${ch.views || 0} reads · Updated ${dateStr}
                </div>
              </div>
            </button>
            <div class="chapter-row-actions" style="display: flex; gap: 0.6rem; align-items: center;">
              <a class="btn-edit" href="edit-chapter.html?book=${encodeURIComponent(currentBook.slug)}&chapter=${encodeURIComponent(ch.id)}" style="display: inline-flex; align-items: center; text-decoration: none; padding: 0.4rem 0.8rem; background: var(--card-bg, #F1EBDF); border: 1px solid var(--line, #E4DDD0); border-radius: var(--radius, 0.25rem); font-size: 0.85rem; color: var(--espresso, #2C1810);">Edit</a>
              <button type="button" class="btn-delete" data-id="${PenauraDOM.escapeHtml(ch.id)}" style="padding: 0.4rem 0.8rem; background: transparent; border: 1px solid #fca5a5; color: #dc2626; border-radius: var(--radius, 0.25rem); font-size: 0.85rem; cursor: pointer;">Delete</button>
            </div>
          </div>
        `;
      });

      chaptersContainer.innerHTML = html;

      chaptersContainer.querySelectorAll(".chapter-read-trigger").forEach(button => {
        button.addEventListener("click", () => openChapterReader(Number(button.dataset.chapterIndex)));
      });

      // Attach delete event listeners
      const deleteButtons = chaptersContainer.querySelectorAll(".btn-delete");
      deleteButtons.forEach(btn => {
        btn.addEventListener("click", async function() {
          const chId = this.getAttribute("data-id");
          if (confirm("Ushbu bobni o'chirmoqchimisiz?")) {
            try {
              await PenauraApi.request(
                `/books/${encodeURIComponent(currentBook.slug)}/chapters/${chId}/`,
                { method: "DELETE" }
              );
              currentBook.chapters = currentBook.chapters.filter(ch => String(ch.id) !== chId);
              renderChapters();
              showAlert("Bob muvaffaqiyatli o'chirildi.", true);
              setTimeout(hideAlert, 2000);
            } catch (error) {
              showAlert(error.message || "Bobni o'chirishda xatolik yuz berdi.");
            }
          }
        });
      });
    }

    // --- IMPORT TABS VA FAYL / GOOGLE DOCS BOSHQARUVI ---
    const tabButtons = document.querySelectorAll(".import-tabs .tab-btn");
    const tabFile = document.getElementById("tab-content-file");
    const tabGDocs = document.getElementById("tab-content-gdocs");
    const dropzone = document.getElementById("chapter-dropzone");
    const fileInput = document.getElementById("chapter-file-input");
    const btnBrowseFile = document.getElementById("btn-browse-file");
    const fileBadge = document.getElementById("file-loaded-badge");
    const fileInfo = document.getElementById("file-loaded-info");
    const btnClearFile = document.getElementById("btn-clear-file");
    const gdocsUrlInput = document.getElementById("gdocs-url-input");
    const btnImportGDocs = document.getElementById("btn-import-gdocs");
    const wordsCounter = document.getElementById("chapter-words-counter");
    const btnAddAndEdit = document.getElementById("btn-add-and-edit-chapter");

    function updateWordsCounter() {
      if (!newContentInput || !wordsCounter) return;
      const text = newContentInput.value.trim();
      const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
      wordsCounter.textContent = `${count} so'z`;
    }

    if (newContentInput) {
      newContentInput.addEventListener("input", updateWordsCounter);
    }

    // Tab almashish
    tabButtons.forEach(btn => {
      btn.addEventListener("click", function() {
        tabButtons.forEach(b => {
          b.classList.remove("active");
          b.style.background = "transparent";
          b.style.color = "var(--espresso-soft, #4A3226)";
        });
        this.classList.add("active");
        this.style.background = "var(--espresso, #2C1810)";
        this.style.color = "var(--cream, #FAF8F4)";

        const tab = this.getAttribute("data-tab");
        if (tabFile) tabFile.style.display = tab === "file" ? "block" : "none";
        if (tabGDocs) tabGDocs.style.display = tab === "gdocs" ? "block" : "none";
        
        if (tab === "manual") {
          newContentInput.focus();
        }
      });
    });

    // Fayl tanlash
    if (btnBrowseFile && fileInput) {
      btnBrowseFile.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", function(e) {
        if (e.target !== btnBrowseFile) {
          fileInput.click();
        }
      });

      dropzone.addEventListener("dragover", function(e) {
        e.preventDefault();
        dropzone.style.background = "#F5ECE3";
        dropzone.style.borderColor = "var(--espresso, #2C1810)";
      });

      dropzone.addEventListener("dragleave", function() {
        dropzone.style.background = "var(--cream, #FAF8F4)";
        dropzone.style.borderColor = "var(--terracotta, #B5622E)";
      });

      dropzone.addEventListener("drop", async function(e) {
        e.preventDefault();
        dropzone.style.background = "var(--cream, #FAF8F4)";
        dropzone.style.borderColor = "var(--terracotta, #B5622E)";
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          await handleUploadedFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener("change", async function(e) {
        if (e.target.files && e.target.files[0]) {
          await handleUploadedFile(e.target.files[0]);
        }
      });
    }

    async function handleUploadedFile(file) {
      if (!window.DocImporter) {
        showAlert("Hujjat o'quvchi modul topilmadi.");
        return;
      }
      try {
        showAlert("Fayl o'qilmoqda, iltimos kuting...", true);
        const parsed = await DocImporter.parseDocumentFile(file);
        
        if (newTitleInput && (!newTitleInput.value.trim() || newTitleInput.value.startsWith("e.g."))) {
          newTitleInput.value = parsed.title;
        }
        if (newContentInput) {
          newContentInput.value = parsed.content;
          updateWordsCounter();
        }

        if (fileBadge && fileInfo) {
          fileBadge.style.display = "flex";
          fileInfo.textContent = `✓ ${parsed.filename} (${parsed.size}, ${parsed.wordsCount} so'z) muvaffaqiyatli yuklandi`;
        }

        showAlert(`✓ "${parsed.filename}" fayli muvaffaqiyatli yuklandi va maydonlar to'ldirildi!`, true);
        setTimeout(hideAlert, 4000);
      } catch (err) {
        console.error("File parse error:", err);
        showAlert("Faylni o'qishda xatolik yuz berdi. Iltimos boshqa formatda (masalan .docx yoki .txt) urinib ko'ring.");
      }
    }

    if (btnClearFile) {
      btnClearFile.addEventListener("click", function(e) {
        e.stopPropagation();
        if (fileInput) fileInput.value = "";
        if (fileBadge) fileBadge.style.display = "none";
        if (newContentInput) {
          newContentInput.value = "";
          updateWordsCounter();
        }
      });
    }

    // Google Docs Import
    if (btnImportGDocs && gdocsUrlInput) {
      btnImportGDocs.addEventListener("click", async function() {
        const url = gdocsUrlInput.value.trim();
        if (!url) {
          showAlert("Iltimos, Google Docs hujjatingiz havolasini kiriting.");
          gdocsUrlInput.focus();
          return;
        }

        if (!window.DocImporter) {
          showAlert("DocImporter moduli mavjud emas.");
          return;
        }

        try {
          showAlert("Google Docs hujjati tekshirilmoqda...", true);
          const res = await DocImporter.importFromGoogleDocs(url);

          if (res.content && res.content.length > 0) {
            if (newTitleInput) newTitleInput.value = res.title;
            if (newContentInput) {
              newContentInput.value = res.content;
              updateWordsCounter();
            }
            showAlert("✓ Google Docs hujjati muvaffaqiyatli import qilindi!", true);
            setTimeout(hideAlert, 4000);
          } else {
            // Google Docs CORS bo'yicha qulay yo'riqnoma ko'rsatish
            const userPasted = prompt(
              `Google Docs havolasi qabul qilindi!

Google Docs xavfsizlik cheklovi tufayli matnni olish uchun:
1. Google Docs hujjatingizga o'tib matnni nusxalang (Ctrl+A, Ctrl+C)
2. Yoki Google Docs'da: Fayl -> Yuklab olish -> Microsoft Word (.docx) qilib 'Docs / Word yuklash' bo'limiga tashlang.

Agar matnni nusxalagan bo'lsangiz, shu yerga joylashtiring (Ctrl+V):`
            );

            if (userPasted && userPasted.trim()) {
              if (newContentInput) {
                newContentInput.value = userPasted.trim();
                updateWordsCounter();
              }
              if (newTitleInput && !newTitleInput.value.trim()) {
                newTitleInput.value = "Google Docs Bobi";
              }
              showAlert("✓ Google Docs matni muvaffaqiyatli joylashtirildi!", true);
              setTimeout(hideAlert, 3000);
            } else {
              hideAlert();
            }
          }
        } catch (err) {
          showAlert(err.message || "Google Docs havolasini import qilishda xatolik yuz berdi.");
        }
      });
    }

    // "Qo'shish va Tahrirlashga o'tish" tugmasi
    if (btnAddAndEdit) {
      btnAddAndEdit.addEventListener("click", async function() {
        hideAlert();
        const title = newTitleInput.value.trim();
        const content = newContentInput ? newContentInput.value : "";
        const isPremium = document.getElementById("ch-type-premium") ? document.getElementById("ch-type-premium").checked : false;

        if (!title) {
          showAlert("Iltimos, bob sarlavhasini (Chapter Title) kiriting.");
          newTitleInput.focus();
          return;
        }

        try {
          const added = await PenauraApi.request(
            `/books/${encodeURIComponent(currentBook.slug)}/chapters/`,
            { method: "POST", body: { title, content, is_premium: isPremium, status: "draft" } }
          );
          window.location.href = `edit-chapter.html?book=${encodeURIComponent(currentBook.slug)}&chapter=${encodeURIComponent(added.id)}`;
        } catch (error) {
          showAlert(error.message || "Bob qo'shishda xatolik yuz berdi.");
        }
      });
    }

    renderChapters();

    // 4. Add New Chapter Handler
    if (btnAddChapter) {
      btnAddChapter.addEventListener("click", async function() {
        hideAlert();
        const title = newTitleInput.value.trim();
        const content = newContentInput ? newContentInput.value : "";
        const isPremium = document.getElementById("ch-type-premium") ? document.getElementById("ch-type-premium").checked : false;

        if (!title) {
          showAlert("Iltimos, bob sarlavhasini (Chapter Title) kiriting.");
          newTitleInput.focus();
          return;
        }

        try {
          const added = await PenauraApi.request(
            `/books/${encodeURIComponent(currentBook.slug)}/chapters/`,
            { method: "POST", body: { title, content, is_premium: isPremium, status: "draft" } }
          );
          currentBook.chapters.push({
            ...added, isPremium: added.is_premium, createdAt: added.created_at,
            updatedAt: added.updated_at,
          });
          renderChapters();
          newTitleInput.value = "";
          if (newContentInput) {
            newContentInput.value = "";
            updateWordsCounter();
          }
          showAlert("✓ Bob qoralama sifatida saqlandi. Tahririyatga yuborish uchun «Edit» ni bosib, «Publish Chapter» tugmasini bosing.", true);
          setTimeout(hideAlert, 8000);
        } catch (error) {
          showAlert(error.message || "Bob qo'shishda xatolik yuz berdi.");
        }
      });
    }
  });