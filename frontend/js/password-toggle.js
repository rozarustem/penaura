/**
 * Penaura — Parol maydonlari uchun "ko'rsatish / yashirish" (ko'z) tugmasi.
 * Sahifadagi barcha input[type="password"] ga avtomatik qo'shiladi.
 */
(function () {
  const STYLE = `
    .pw-field { position: relative; display: block; width: 100%; }
    .pw-field > input { width: 100%; box-sizing: border-box; padding-right: 2.9rem !important; }
    .pw-field > input::-ms-reveal, .pw-field > input::-ms-clear { display: none; }
    .pw-toggle { position: absolute; top: 50%; right: 0.55rem; transform: translateY(-50%);
      display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem;
      padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer;
      color: var(--espresso-soft, #7A6A5C); }
    .pw-toggle:hover { color: var(--espresso, #2C1810); }
    .pw-toggle:focus-visible { outline: 2px solid var(--terracotta, #B5622E); outline-offset: 1px; }
    .pw-toggle svg { width: 18px; height: 18px; display: block; }
  `;
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.5 10.5 0 0 1 12 4c7 0 11 7 11 7a19.9 19.9 0 0 1-3.17 4.19"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function enhance(input) {
    if (input.dataset.pwToggle) return;
    input.dataset.pwToggle = '1';

    const wrap = document.createElement('div');
    wrap.className = 'pw-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pw-toggle';
    wrap.appendChild(button);

    function render(visible) {
      input.type = visible ? 'text' : 'password';
      button.innerHTML = visible ? EYE_OFF : EYE;
      button.setAttribute('aria-pressed', visible ? 'true' : 'false');
      button.setAttribute('aria-label', visible ? 'Parolni yashirish' : 'Parolni ko\'rsatish');
      button.title = button.getAttribute('aria-label');
    }
    render(false);

    button.addEventListener('click', () => render(input.type === 'password'));
    // Forma tozalanganda (masalan parol almashgach) maydon yana yashirin bo'lsin
    if (input.form) input.form.addEventListener('reset', () => render(false));
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    document.querySelectorAll('input[type="password"]').forEach(enhance);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();