/**
 * Penaura — Email tasdiqlash (verify.html)
 * Havola: verify.html?email=...&from=signup
 * 6 xonali kod: POST /auth/verify-email/, qayta yuborish: POST /auth/resend-verification/
 */
(function () {
  const RESEND_SECONDS = 60;

  function initVerify() {
    const params = new URLSearchParams(window.location.search);
    const email = (params.get('email') || '').trim().toLowerCase();

    const alertBox = document.getElementById('verify-alert');
    const form = document.getElementById('verify-form');
    const submitBtn = document.getElementById('verify-submit');
    const resendBtn = document.getElementById('resend-btn');
    const otpInputs = Array.from(document.querySelectorAll('.otp-row input'));
    const emailHighlight = document.querySelector('.email-highlight');

    function showAlert(message, isSuccess) {
      alertBox.style.display = 'block';
      alertBox.style.background = isSuccess ? 'rgba(74, 150, 96, 0.15)' : 'rgba(181, 98, 46, 0.15)';
      alertBox.style.color = isSuccess ? '#2d6a4f' : 'var(--terracotta)';
      alertBox.style.border = isSuccess ? '1px solid #74c69d' : '1px solid var(--terracotta-soft)';
      alertBox.textContent = message;
    }

    function readCode() {
      return otpInputs.map(function (i) { return i.value; }).join('');
    }

    function clearCode() {
      otpInputs.forEach(function (i) { i.value = ''; });
      otpInputs[0].focus();
    }

    if (!email) {
      showAlert('Email manzil topilmadi. Avval ro\'yxatdan o\'ting yoki tizimga kirishga urinib ko\'ring.', false);
      form.querySelectorAll('input, button').forEach(function (el) { el.disabled = true; });
      resendBtn.disabled = true;
      return;
    }
    if (emailHighlight) emailHighlight.textContent = email;

    /* --- OTP maydonlari --- */
    otpInputs.forEach(function (input, index) {
      input.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length === 1 && index < otpInputs.length - 1) otpInputs[index + 1].focus();
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !this.value && index > 0) otpInputs[index - 1].focus();
      });

      input.addEventListener('paste', function (e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pasted.replace(/[^0-9]/g, '').slice(0, otpInputs.length);
        digits.split('').forEach(function (d, i) { otpInputs[i].value = d; });
        otpInputs[Math.min(digits.length, otpInputs.length - 1)].focus();
      });
    });
    otpInputs[0].focus();

    /* --- Tasdiqlash --- */
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const code = readCode();
      if (code.length < otpInputs.length) {
        showAlert('Iltimos, 6 xonali tasdiqlash kodini to\'liq kiriting.', false);
        return;
      }
      submitBtn.disabled = true;
      try {
        await PenauraApi.request('/auth/verify-email/', {
          method: 'POST', public: true, body: { email: email, code: code },
        });
        showAlert('Email tasdiqlandi ✓ Kirish sahifasiga yo\'naltirilmoqda...', true);
        setTimeout(function () {
          window.location.href = 'signin.html?email=' + encodeURIComponent(email);
        }, 1400);
      } catch (error) {
        showAlert(error.message || 'Tasdiqlab bo\'lmadi. Qaytadan urinib ko\'ring.', false);
        clearCode();
        submitBtn.disabled = false;
      }
    });

    /* --- Qayta yuborish (60 soniyalik kutish) --- */
    let timer = null;
    function startCooldown() {
      let left = RESEND_SECONDS;
      resendBtn.disabled = true;
      resendBtn.textContent = 'Resend in ' + left + 's';
      clearInterval(timer);
      timer = setInterval(function () {
        left -= 1;
        if (left <= 0) {
          clearInterval(timer);
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend it';
        } else {
          resendBtn.textContent = 'Resend in ' + left + 's';
        }
      }, 1000);
    }

    resendBtn.addEventListener('click', async function () {
      resendBtn.disabled = true;
      try {
        const result = await PenauraApi.request('/auth/resend-verification/', {
          method: 'POST', public: true, body: { email: email },
        });
        showAlert(result && result.detail ? result.detail : 'Yangi kod yuborildi.', true);
        clearCode();
        startCooldown();
      } catch (error) {
        showAlert(error.message || 'Kodni yuborib bo\'lmadi. Birozdan keyin urinib ko\'ring.', false);
        resendBtn.disabled = false;
      }
    });

    /* Ro'yxatdan o'tgandan keyin kod hozirgina yuborilgan: darhol qayta yuborish shart emas. */
    if (params.get('from') === 'signup') {
      showAlert('Tasdiqlash kodi emailingizga yuborildi. Pochta qutingizni (Spam papkasini ham) tekshiring.', true);
      startCooldown();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVerify);
  } else {
    initVerify();
  }
})();