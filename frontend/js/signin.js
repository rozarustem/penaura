document.addEventListener('DOMContentLoaded', function() {
    const signinForm = document.getElementById('signin-form');
    const alertBox = document.getElementById('signin-alert');

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

    // verify.html tasdiqdan keyin ?email=... bilan qaytaradi: emailni oldindan to'ldiramiz
    const prefill = new URLSearchParams(window.location.search).get('email');
    const emailInput = document.getElementById('email');
    if (prefill && emailInput) {
      emailInput.value = prefill;
      showAlert('Email tasdiqlandi. Endi tizimga kirishingiz mumkin.', true);
    }

    if (signinForm) {
      signinForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAlert();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // 1. Maydonlar to'ldirilganini tekshirish
        if (!email) {
          showAlert('Iltimos, email manzilingizni kiriting.');
          return;
        }

        if (!password) {
          showAlert('Iltimos, parolingizni kiriting.');
          return;
        }

        // 2. Storage orqali login qilish
        try {
          const user = await PenauraApi.login(email, password);
          showAlert('Hush kelibsiz, ' + user.name + '! Bosh sahifaga yo\'naltirilmoqda...', true);
        } catch (error) {
          if (error.code === 'email_not_verified') {
            showAlert(error.message);
            setTimeout(function() {
              window.location.href = 'verify.html?email=' + encodeURIComponent(email.toLowerCase());
            }, 1500);
            return;
          }
          showAlert(error.message || 'Email yoki parol noto\'g\'ri.');
          return;
        }

        setTimeout(function() {
          window.location.href = 'index.html';
        }, 1000);
      });
    }
  });