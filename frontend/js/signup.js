document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    const alertBox = document.getElementById('signup-alert');

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

    const agreeBox = document.getElementById('agree-terms');
    const submitBtn = document.getElementById('signup-submit');

    // Shartlarga rozilik belgilanmaguncha "Create Account" tugmasi o'chiq turadi
    function syncSubmitState() {
      if (submitBtn && agreeBox) submitBtn.disabled = !agreeBox.checked;
    }
    if (agreeBox) {
      agreeBox.addEventListener('change', syncSubmitState);
      syncSubmitState(); // brauzer sahifa yangilanganda belgini eslab qolgan bo'lishi mumkin
    }

    if (signupForm) {
      signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAlert();

        if (!agreeBox || !agreeBox.checked) {
          showAlert('Davom etish uchun Shartlar va Maxfiylik siyosatiga rozilik bering.');
          return;
        }

        const fullname = document.getElementById('fullname').value.trim();
        const email = document.getElementById('signup-email').value.trim().toLowerCase();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const roleWriter = document.getElementById('role-writer').checked;
        const role = roleWriter ? 'writer' : 'reader';

        // 1. Bo'sh maydonlarni tekshirish
        if (!fullname) {
          showAlert('Iltimos, to\'liq ismingizni kiriting.');
          return;
        }

        if (!email) {
          showAlert('Iltimos, email manzilingizni kiriting.');
          return;
        }

        // 2. Email formati
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showAlert('Iltimos, to\'g\'ri email formatini kiriting (masalan: user@example.com).');
          return;
        }

        // 3. Parol uzunligi
        if (!password) {
          showAlert('Iltimos, parol kiriting.');
          return;
        }

        if (password.length < 8) {
          showAlert('Parol kamida 8 ta belgidan iborat bo\'lishi kerak.');
          return;
        }

        // 4. Parollarning mosligi
        if (password !== confirmPassword) {
          showAlert('Kiritilgan parollar bir-biriga mos kelmadi.');
          return;
        }

        try {
          await PenauraApi.register({ name: fullname, email, phone, password, role });
        } catch (error) {
          showAlert(error.message || 'Ro‘yxatdan o‘tishda xatolik yuz berdi.');
          return;
        }

        showAlert('Ro\'yxatdan o\'tdingiz! Emailingizga tasdiqlash kodi yuborildi...', true);

        setTimeout(function() {
          window.location.href = 'verify.html?from=signup&email=' + encodeURIComponent(email);
        }, 1200);
      });
    }
  });