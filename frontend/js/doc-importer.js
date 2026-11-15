/**
 * ============================================================
 *  Penaura — Document & Google Docs Importer (js/doc-importer.js)
 *  1. Word (.docx, .doc), Text (.txt, .md) va PDF fayllarni o'qish
 *  2. Google Docs havolasidan matnni import qilish
 *  3. Bob sarlavhasi va matnini avtomatik to'ldirish
 * ============================================================
 */

(function() {
  /**
   * Fayl nomidan toza sarlavha hosil qilish
   * e.g. "1-bob_dashtdan_o'tish.docx" -> "1-bob dashtdan o'tish"
   */
  function cleanTitleFromFilename(filename) {
    if (!filename) return '';
    return filename
      .replace(/\.[^/.]+$/, '') // extensionni olib tashlash
      .replace(/[_-]+/g, ' ')  // chiziqchalarni bo'shliqqa aylantirish
      .trim();
  }

  /**
   * Google Docs URL'idan Doc ID olish
   */
  function extractGoogleDocId(url) {
    if (!url) return null;
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  /**
   * .docx faylni o'qish (Mammoth.js orqali yoki fallback)
   */
  async function parseDocxFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        if (typeof mammoth !== 'undefined') {
          mammoth.extractRawText({ arrayBuffer: arrayBuffer })
            .then(function(result) {
              resolve(result.value || '');
            })
            .catch(function(err) {
              console.warn('Mammoth parsing error, trying fallback:', err);
              parseTextFileFallback(file, resolve, reject);
            });
        } else {
          parseTextFileFallback(file, resolve, reject);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Oddiy .txt / .md fayllarni o'qish
   */
  async function parseTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        resolve(e.target.result || '');
      };
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
  }

  /**
   * Fallback matn o'quvchi
   */
  function parseTextFileFallback(file, resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(e) {
      resolve(e.target.result || '');
    };
    reader.onerror = reject;
    reader.readAsText(file);
  }

  /**
   * Har qanday faylni avtomatik aniqlab o'qish
   */
  async function parseDocumentFile(file) {
    const name = file.name.toLowerCase();
    let text = '';

    if (name.endsWith('.docx')) {
      text = await parseDocxFile(file);
    } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html')) {
      text = await parseTextFile(file);
    } else {
      // Boshqa fayl turlari uchun (doc, rtf, text)
      text = await parseTextFile(file);
    }

    return {
      title: cleanTitleFromFilename(file.name),
      content: text.trim(),
      filename: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      wordsCount: text.split(/\s+/).filter(Boolean).length,
    };
  }

  /**
   * Google Docs havolasidan import qilish
   */
  async function importFromGoogleDocs(url) {
    const docId = extractGoogleDocId(url);
    if (!docId) {
      throw new Error('Noto\'g\'ri Google Docs havolasi. Havola quyidagi formatda bo\'lishi kerak:\nhttps://docs.google.com/document/d/.../edit');
    }

    // Google Docs eksport URL'lari
    const exportTxtUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    try {
      // 1. To'g'ridan-to'g'ri fetch qilib ko'ramiz (agar CORS ruxsat berilgan bo'lsa)
      const res = await fetch(exportTxtUrl);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 10) {
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          const firstLine = lines.length > 0 ? lines[0].trim() : 'Google Docs bobi';
          return {
            title: firstLine.length < 80 ? firstLine : 'Yangi Bob (Google Docs)',
            content: text.trim(),
            source: 'google_docs',
          };
        }
      }
    } catch (e) {
      console.info('Direct Google Docs fetch blocked by CORS, switching to client instructions mode.');
    }

    // Agar CORS cheklovi bo'lsa (Google Docs default holatda CORS block qiladi):
    return {
      title: 'Google Docs Bobi',
      content: '',
      docId: docId,
      needsManualPaste: true,
      exportUrl: exportTxtUrl,
    };
  }

  // Global export
  window.DocImporter = {
    parseDocumentFile,
    importFromGoogleDocs,
    extractGoogleDocId,
    cleanTitleFromFilename,
  };
})();
