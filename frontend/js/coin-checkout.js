(function() {
  const packages = {
    '5': { coins: 5, bonus: 0, price: 10000 },
    '15': { coins: 15, bonus: 2, price: 25000 },
    '40': { coins: 40, bonus: 8, price: 60000 },
    '100': { coins: 100, bonus: 25, price: 140000 },
  };

  function initCheckout() {
    const params = new URLSearchParams(window.location.search);
    const selectedPackage = packages[params.get('package')];
    const form = document.getElementById('payment-form');
    const status = document.getElementById('checkout-status');
    const submit = form.querySelector('.checkout-submit');
    const formatPrice = value => `${new Intl.NumberFormat('uz-UZ').format(value)} so'm`;

    if (!selectedPackage) {
      status.hidden = false;
      status.textContent = 'Package not found. Return to the coin store and choose a package.';
      status.classList.add('is-error');
      submit.disabled = true;
      return;
    }

    const { coins, bonus, price } = selectedPackage;
    document.getElementById('checkout-coins').textContent = `${coins} coins`;
    document.getElementById('checkout-bonus').textContent = bonus ? `+${bonus} bonus coins` : '';
    document.getElementById('summary-coins').textContent = `${coins}`;
    document.getElementById('summary-total').textContent = `${coins + bonus}`;
    document.getElementById('summary-price').textContent = formatPrice(price);

    if (bonus) {
      document.getElementById('summary-bonus').textContent = `${bonus}`;
      document.getElementById('summary-bonus-row').hidden = false;
    }

    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      const user = Storage.getCurrentUser();

      status.hidden = false;
      status.classList.remove('is-ok');
      status.classList.add('is-error');
      if (!user) {
        status.textContent = 'Please sign in before continuing with a coin purchase.';
        return;
      }

      const provider = form.querySelector('input[name="payment-method"]:checked').value.toLowerCase();
      submit.disabled = true;
      status.classList.remove('is-error');
      status.textContent = 'Processing...';
      try {
        // Narxni server o'zi hisoblaydi: faqat paket kaliti va to'lov usuli yuboriladi.
        const order = await PenauraApi.request('/payments/orders/', {
          method: 'POST',
          body: { provider, package: params.get('package') },
        });
        if (provider === 'click') {
          window.location.href = order.pay_url;   // Click to'lov sahifasiga o'tadi
          return;
        }
        // Demo: backend (DEBUG + PAYMENTS_MOCK) buyurtmani darhol "to'langan" qiladi.
        const paid = await PenauraApi.request(`/payments/orders/${order.order_id}/mock-pay/`, { method: 'POST' });
        const wallet = await PenauraApi.request('/auth/wallet/');
        status.classList.add('is-ok');
        status.textContent = `Payment successful. ${paid.total_coins} coins added. New balance: ${wallet.balance} coins.`;
      } catch (error) {
        status.classList.add('is-error');
        status.textContent = error.message || 'Payment failed. Please try again.';
      } finally {
        submit.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckout);
  } else {
    initCheckout();
  }
})();