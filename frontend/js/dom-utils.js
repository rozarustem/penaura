(function(global) {
  const safeRichTextTags = new Set([
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'blockquote', 'h2', 'h3', 'ul', 'ol', 'li',
  ]);
  const blockedRichTextTags = new Set(['script', 'style', 'iframe', 'object', 'svg', 'math']);

  function escapeHtml(value) {
    const replacements = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return String(value == null ? '' : value).replace(/[&<>"']/g, character => replacements[character]);
  }

  function getSafeImageUrl(value) {
    const source = String(value || '').trim();
    if (!source) return '';

    if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]+=*$/i.test(source)) {
      return source;
    }

    if (/^images\/(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9._/-]+$/i.test(source)) {
      return source;
    }

    try {
      const url = new URL(source);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function createSafeRichText(value) {
    const parsed = new DOMParser().parseFromString(String(value || ''), 'text/html');
    const fragment = document.createDocumentFragment();

    function appendSafeNode(source, target) {
      if (source.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(source.nodeValue || ''));
        return;
      }
      if (source.nodeType !== Node.ELEMENT_NODE) return;

      const tagName = source.tagName.toLowerCase();
      if (blockedRichTextTags.has(tagName)) return;
      if (!safeRichTextTags.has(tagName)) {
        Array.from(source.childNodes).forEach(child => appendSafeNode(child, target));
        return;
      }

      const element = document.createElement(tagName);
      Array.from(source.childNodes).forEach(child => appendSafeNode(child, element));
      target.appendChild(element);
    }

    Array.from(parsed.body.childNodes).forEach(node => appendSafeNode(node, fragment));
    return fragment;
  }

  global.PenauraDOM = Object.freeze({
    createSafeRichText,
    escapeHtml,
    getSafeImageUrl,
  });
})(window);
