/**
 * Penaura — Yozuvchi daromadi (settings.html ichidagi "Earnings" bo'limi).
 *   GET  /auth/earnings/           — jami daromad, yechilgan, kutilayotgan, sotuvlar tarixi
 *   POST /auth/earnings/withdraw/  — pul yechish so'rovi (summa + karta oxirgi 4 raqami)
 * Bo'lim faqat writer roli uchun ko'rinadi. Pulni bo'lish (70/30) serverda, bob ochilgan zahoti bajariladi.
 */
(function () {
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('uz-UZ').format(n || 0) + " so'm";
  const date = v => (v ? new Date(v).toLocaleDateString('en-GB') : '—');
  const STATUS = { pending: 'Pending', paid: 'Paid', rejected: 'Rejected' };

  function cell(tr, text, cls) {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    tr.appendChild(td);
  }

  function fillRows(body, rows, emptyText, cols) {
    body.textContent = '';
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = cols; td.className = 'empty'; td.textContent = emptyText;
      tr.appendChild(td); body.appendChild(tr);
      return;
    }
    rows.forEach(fn => body.appendChild(fn()));
  }

  /* 70/30 bo'linishini aniq ko'rsatadi: chiziq, 1 tangalik misol va jami summalar. */
  function renderSplit(data) {
    const writerPct = Number(data.writer_percent);
    const platformPct = 100 - writerPct;
    $('earnings-desc').textContent =
      `Every time a reader unlocks one of your chapters, the payment is split instantly: ` +
      `${writerPct}% goes to you and ${platformPct}% goes to the platform.`;

    $('split-writer').style.flexGrow = String(writerPct);
    $('split-platform').style.flexGrow = String(platformPct);
    $('split-writer-label').textContent = `You · ${writerPct}%`;
    $('split-platform-label').textContent = `Platform · ${platformPct}%`;
    $('split-bar').setAttribute('aria-label',
      `Revenue split: ${writerPct}% to the writer, ${platformPct}% to the platform`);

    const gross = Number(data.rate_som) || 0;
    const mine = Math.floor(gross * writerPct / 100);
    $('split-example').textContent =
      `Example: a reader pays 1 coin (${fmt(gross)}) → you get ${fmt(mine)}, the platform gets ${fmt(gross - mine)}.`;

    const totals = $('split-totals');
    totals.textContent = '';
    [['Readers paid in total', data.gross_som],
     [`Your share (${writerPct}%)`, data.earned_som],
     [`Platform (${platformPct}%)`, data.platform_som]].forEach(([label, value]) => {
      const box = document.createElement('div'); box.className = 'split-total';
      const small = document.createElement('small'); small.textContent = label;
      const strong = document.createElement('strong'); strong.textContent = fmt(value);
      box.append(small, strong); totals.appendChild(box);
    });

    $('th-writer').textContent = `Your share (${writerPct}%)`;
    $('th-platform').textContent = `Platform (${platformPct}%)`;
  }

  function render(data) {
    renderSplit(data);

    const stats = $('earn-stats');
    stats.textContent = '';
    [['Available', data.available_som], ['Total earned', data.earned_som],
     ['Pending payout', data.pending_som], ['Paid out', data.paid_som]].forEach(([label, value]) => {
      const box = document.createElement('div'); box.className = 'earn-stat';
      const small = document.createElement('small'); small.textContent = label;
      const strong = document.createElement('strong'); strong.textContent = fmt(value);
      box.append(small, strong); stats.appendChild(box);
    });

    $('withdraw-hint').textContent = `Minimum ${fmt(data.min_withdrawal_som)}. Available now: ${fmt(data.available_som)}.`;
    $('withdraw-amount').min = data.min_withdrawal_som;
    $('withdraw-amount').max = Math.max(data.available_som, data.min_withdrawal_som);

    fillRows($('earn-splits'), data.splits.map(s => () => {
      const tr = document.createElement('tr');
      cell(tr, date(s.created_at)); cell(tr, `${s.book} — ${s.chapter}`);
      cell(tr, String(s.coins)); cell(tr, fmt(s.gross_som));
      cell(tr, fmt(s.writer_som), 'earn-mine'); cell(tr, fmt(s.platform_som), 'earn-platform');
      return tr;
    }), 'No sales yet. Earnings appear here as soon as a reader unlocks a chapter.', 6);

    fillRows($('earn-withdrawals'), data.withdrawals.map(w => () => {
      const tr = document.createElement('tr');
      cell(tr, date(w.created_at)); cell(tr, fmt(w.amount_som)); cell(tr, '•••• ' + w.card_last4);
      cell(tr, STATUS[w.status] + (w.reject_reason ? ` (${w.reject_reason})` : ''));
      return tr;
    }), 'No payout requests yet.', 4);
  }

  function status(message, ok) {
    const el = $('withdraw-status');
    el.textContent = message || '';
    el.className = 'form-status' + (message ? (ok ? ' is-ok' : ' is-error') : '');
  }

  async function load() {
    render(await PenauraApi.request('/auth/earnings/'));
  }

  async function init() {
    const section = $('earnings-section');
    if (!section || typeof PenauraApi === 'undefined') return;
    let me;
    try { me = await PenauraApi.request('/auth/me/'); } catch (e) { return; }
    if (!me || me.role !== 'writer') return;
    section.hidden = false;
    try { await load(); } catch (e) { status(e.message || 'Could not load earnings.', false); }

    $('withdraw-form').addEventListener('submit', async event => {
      event.preventDefault();
      const btn = event.target.querySelector('.btn-save');
      btn.disabled = true; status('');
      try {
        await PenauraApi.request('/auth/earnings/withdraw/', {
          method: 'POST',
          body: { amount_som: Number($('withdraw-amount').value), card_last4: $('withdraw-card').value.trim() },
        });
        event.target.reset();
        status('Payout request sent. A finance manager will review it.', true);
        await load();
      } catch (e) {
        status(e.message || 'Request failed.', false);
      } finally { btn.disabled = false; }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();