/**
 * ============================================================
 *  Penaura — Coins Controller (js/coins.js)
 *  Tanga balansi, paketlarni xarid qilish va to'lov simulyatsiyasi.
 * ============================================================
 */

(function() {
  function updateBalanceDisplay(balance) {
    const balanceElements = document.querySelectorAll('.current-balance .num, .balance-num, .coins-num');
    balanceElements.forEach(el => {
      el.textContent = `${balance} coins`;
    });

    const simpleBalances = document.querySelectorAll('.profile-stat-card .num, .coins-badge .num, .coin-widget .num');
    simpleBalances.forEach(el => {
      if (el.textContent.includes('coin') || el.closest('.coins-card')) {
        el.textContent = `${balance} coins`;
      }
    });
  }

  async function initCoins() {
    const currentUser = Storage.getCurrentUser();
    if (!currentUser || !PenauraApi.getAccessToken()) {
      updateBalanceDisplay('—');
      return;
    }
    try {
      const wallet = await PenauraApi.request('/auth/wallet/');
      updateBalanceDisplay(wallet.balance);
    } catch (error) {
      updateBalanceDisplay('—');
      console.error('Wallet balance could not be loaded:', error);
    }

    document.querySelectorAll('.coin-package .btn-purchase').forEach(button => {
      button.addEventListener('click', function() {
        const card = this.closest('.coin-package');
        const amountText = card?.querySelector('.amount')?.textContent || '';
        const amount = amountText.match(/\d+/)?.[0];
        if (amount) {
          window.location.href = `checkout.html?package=${encodeURIComponent(amount)}`;
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCoins);
  } else {
    initCoins();
  }
})();
