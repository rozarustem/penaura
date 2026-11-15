/**
 * ============================================================
 *  Penaura — Til (i18n) tizimi (js/i18n.js)
 *
 *  Tanlangan til: localStorage "penaura_lang" = "uz" | "en" | "ru"
 *  (sozlamalar sahifasida o'zgartiriladi; js/storage.js bu faylni avtomatik ulaydi).
 *
 *  Ishlash usuli: sahifadagi matnlar (va placeholder / title / aria-label) lug'atdan
 *  qidiriladi va almashtiriladi. JS orqali keyin chizilgan matnlar ham
 *  MutationObserver yordamida tarjima qilinadi. Asl matn eslab qolinadi,
 *  shuning uchun tillar orasida sahifani yangilamasdan almashish mumkin.
 *
 *  Yangi matn qo'shish: quyidagi EN yoki UZ massiviga qator qo'shing.
 *    EN: ['English matn', "O'zbekcha", 'Русский']
 *    UZ: ["Asl o'zbekcha matn", 'English', 'Русский']
 *  Lug'atda yo'q matnlar o'zgarishsiz qoladi.
 * ============================================================
 */
(function () {
  'use strict';

  const KEY = 'penaura_lang';
  const LANGS = ['uz', 'en', 'ru'];
  const DEFAULT_LANG = 'en';
  const LEGACY = { "O'zbek": 'uz', 'English': 'en', 'Русский': 'ru' }; // eski versiya nom bilan saqlagan

  /* ---------- Lug'at: asl matn inglizcha ---------- */
  const EN = [
    // Umumiy navigatsiya va footer
    ['Discover', 'Kashf etish', 'Обзор'],
    ['Fiction', 'Nasr', 'Проза'],
    ['Poetry', "She'riyat", 'Поэзия'],
    ['Blog', 'Blog', 'Блог'],
    ['About', 'Biz haqimizda', 'О нас'],
    ['Search', 'Qidiruv', 'Поиск'],
    ['Sign In', 'Kirish', 'Войти'],
    ['Sign in', 'Kirish', 'Войти'],
    ['Sign up', "Ro'yxatdan o'tish", 'Регистрация'],
    ['Home', 'Bosh sahifa', 'Главная'],
    ['HOME', 'BOSH SAHIFA', 'ГЛАВНАЯ'],
    ['A home for writers and the readers who love them.', "Yozuvchilar va ularni sevuvchi o'quvchilar uchun uy.", 'Дом для писателей и читателей, которые их любят.'],
    ['Where every word finds its reader.', "Har bir so'z o'z o'quvchisini topadi.", 'Где каждое слово находит своего читателя.'],
    ['Where every word finds its reader', "Har bir so'z o'z o'quvchisini topadi", 'Где каждое слово находит своего читателя'],
    ['© 2026 Penaura. All rights reserved.', '© 2026 Penaura. Barcha huquqlar himoyalangan.', '© 2026 Penaura. Все права защищены.'],
    ['DISCOVER', 'KASHF ETISH', 'ОБЗОР'],
    ['WRITERS', 'YOZUVCHILAR', 'ПИСАТЕЛЯМ'],
    ['TOP GENRES', 'ENG MASHHUR JANRLAR', 'ПОПУЛЯРНЫЕ ЖАНРЫ'],
    ['HELP', 'YORDAM', 'ПОМОЩЬ'],
    ['Essays', 'Esselar', 'Эссе'],
    ['Non-fiction', 'Hujjatli nasr', 'Нон-фикшн'],
    ['Start Writing', 'Yozishni boshlash', 'Начать писать'],
    ['Writer Tips', 'Yozuvchi maslahatlari', 'Советы писателям'],
    ['Publishing Guide', "Nashr qo'llanmasi", 'Руководство по публикации'],
    ['Workshops', 'Ustaxonalar', 'Мастер-классы'],
    ['Literary Fiction', 'Adabiy nasr', 'Литературная проза'],
    ['Romance', 'Romantika', 'Романтика'],
    ['Mystery', 'Detektiv', 'Детектив'],
    ['Sci-Fi', 'Ilmiy fantastika', 'Научная фантастика'],
    ['About Penaura', 'Penaura haqida', 'О Penaura'],
    ['Careers', 'Karyera', 'Карьера'],
    ['Contact', 'Aloqa', 'Контакты'],
    ['Terms', 'Shartlar', 'Условия'],
    ['Privacy Policy', 'Maxfiylik siyosati', 'Политика конфиденциальности'],
    ['STAY LITERARY', 'ADABIYOT BILAN QOLING', 'ОСТАВАЙТЕСЬ С ЛИТЕРАТУРОЙ'],
    ['Get Stories Worth Reading Straight to Your Inbox', "O'qishga arziydigan hikoyalar to'g'ridan-to'g'ri pochtangizga", 'Лучшие истории — прямо на вашу почту'],
    ['Subscribe', "Obuna bo'lish", 'Подписаться'],
    ['Subscribe and read our', "Obuna bo'lib, quyidagiga rozilik bildirasiz:", 'Подписываясь, вы принимаете:'],
    ["Subscribe to our weekly digest — curated fiction, poetry, and essays from Penaura's best writers. No noise, just literature.",
      "Haftalik dayjestga obuna bo'ling — Penauraning eng yaxshi yozuvchilaridan saralangan nasr, she'riyat va esselar. Ortiqcha shovqinsiz, faqat adabiyot.",
      'Подпишитесь на еженедельный дайджест — отобранные проза, поэзия и эссе лучших авторов Penaura. Без шума, только литература.'],
    ['Your email address', 'Email manzilingiz', 'Ваш адрес электронной почты'],
    ['your email address', 'email manzilingiz', 'ваш адрес электронной почты'],
    ['Close', 'Yopish', 'Закрыть'],
    ['Edit', 'Tahrirlash', 'Изменить'],

    // Bosh sahifa
    ['Penaura — Where Untold Stories Come to Life', 'Penaura — aytilmagan hikoyalar hayotga qaytadi', 'Penaura — здесь оживают нерассказанные истории'],
    ['Discover Stories', 'Hikoyalarni kashf eting', 'Открывайте истории'],
    ['Latest Stories', 'Yangi hikoyalar', 'Новые истории'],
    ['Explore stories', 'Hikoyalarni ko\'rish', 'Смотреть истории'],
    ['Explore stories →', "Hikoyalarni ko'rish →", 'Смотреть истории →'],
    ['Browse more →', "Ko'proq ko'rish →", 'Смотреть ещё →'],
    ['Currently Reading', "Hozir o'qilmoqda", 'Сейчас читаю'],
    ['Writers You Follow', 'Kuzatayotgan yozuvchilaringiz', 'Авторы, на которых вы подписаны'],
    ['Author Spotlight', 'Yozuvchi e\'tiborda', 'Автор в центре внимания'],
    ['Discover writers →', 'Yozuvchilarni kashf eting →', 'Открыть авторов →'],
    ['See all authors →', "Barcha yozuvchilarni ko'rish →", 'Все авторы →'],
    ['Read more articles →', "Boshqa maqolalarni o'qish →", 'Читать другие статьи →'],
    ['Start writing →', 'Yozishni boshlash →', 'Начать писать →'],
    ['📖 Start writing', '📖 Yozishni boshlash', '📖 Начать писать'],
    ['Ready to find your readers?', "O'quvchilaringizni topishga tayyormisiz?", 'Готовы найти своих читателей?'],

    // Janrlar, saralash, she'riyat
    ['All', 'Barchasi', 'Все'],
    ['Literary', 'Adabiy', 'Литературная'],
    ['Historical', 'Tarixiy', 'Историческая'],
    ['Fantasy', 'Fantastika', 'Фэнтези'],
    ['Thriller', 'Triller', 'Триллер'],
    ['Adventure', 'Sarguzasht', 'Приключения'],
    ['Popular', 'Mashhur', 'Популярное'],
    ['Sort: Most Popular', 'Saralash: eng mashhur', 'Сортировка: самые популярные'],
    ['Sort: Newest', 'Saralash: eng yangi', 'Сортировка: новые'],
    ['Sort: Highest Rated', 'Saralash: eng yuqori baholangan', 'Сортировка: с высоким рейтингом'],
    ['Sort: Most Read', "Saralash: eng ko'p o'qilgan", 'Сортировка: самые читаемые'],
    ["Short verses from Penaura's poets — read them, sit with them, and rate the ones that stay with you.",
      "Penaura shoirlarining qisqa she'rlari — o'qing, mulohaza qiling va yurakda qolganlarini baholang.",
      'Короткие стихи поэтов Penaura — читайте, размышляйте и оценивайте те, что остаются с вами.'],
    ['Love', 'Sevgi', 'Любовь'], ['LOVE', 'SEVGI', 'ЛЮБОВЬ'],
    ['Grief', "Qayg'u", 'Горе'], ['GRIEF', "QAYG'U", 'ГОРЕ'],
    ['Nature', 'Tabiat', 'Природа'], ['NATURE', 'TABIAT', 'ПРИРОДА'],
    ['Identity', "O'zlik", 'Идентичность'], ['IDENTITY', "O'ZLIK", 'ИДЕНТИЧНОСТЬ'],
    ['Life', 'Hayot', 'Жизнь'],
    ['☆ Bookmark', '☆ Saqlash', '☆ В закладки'],
    ['★ Saved', '★ Saqlangan', '★ Сохранено'],
    ['Bookmark this poem', "Bu she'rni saqlash", 'Сохранить это стихотворение'],
    ['↑ Click to collapse', '↑ Yopish uchun bosing', '↑ Нажмите, чтобы свернуть'],
    ['Poem', "She'r", 'Стихотворение'],

    // Kitob sahifasi va o'qish
    ['Start reading →', "O'qishni boshlash →", 'Начать читать →'],
    ['♡ Like', '♡ Yoqdi', '♡ Нравится'],
    ['♡ Follow & Read', "♡ Kuzatish va o'qish", '♡ Подписаться и читать'],
    ['🔖 Save', '🔖 Saqlash', '🔖 Сохранить'],
    ['🔖 Saved', '🔖 Saqlangan', '🔖 Сохранено'],
    ['Chapters', 'Boblar', 'Главы'],
    ['Chapter', 'Bob', 'Глава'],
    ['← Back to book', '← Kitobga qaytish', '← К книге'],
    ['← Back to Book', '← Kitobga qaytish', '← К книге'],
    ['← Previous chapter', '← Oldingi bob', '← Предыдущая глава'],
    ['Next chapter →', 'Keyingi bob →', 'Следующая глава →'],
    ['Premium chapter', 'Premium bob', 'Премиум-глава'],
    ['Unlock', 'Ochish', 'Открыть'],
    ['Buy coins →', 'Tanga sotib olish →', 'Купить монеты →'],
    ['Buy Coins →', 'Tanga sotib olish →', 'Купить монеты →'],
    ['Free', 'Bepul', 'Бесплатно'],
    ['📖 Free', '📖 Bepul', '📖 Бесплатно'],
    ['by', 'muallif:', 'автор:'],
    ['Book — Penaura', 'Kitob — Penaura', 'Книга — Penaura'],
    ['← All stories', '← Barcha hikoyalar', '← Все истории'],

    // Kirish, ro'yxatdan o'tish, parol
    ['WELCOME BACK', 'XUSH KELIBSIZ', 'С ВОЗВРАЩЕНИЕМ'],
    ['Sign in to Penaura', 'Penauraga kirish', 'Вход в Penaura'],
    ['Continue reading, writing, and picking up right where you left off.', "O'qish va yozishni to'xtagan joyingizdan davom ettiring.", 'Продолжайте читать и писать с того места, где остановились.'],
    ['Continue with Google', 'Google bilan davom etish', 'Продолжить через Google'],
    ['OR CONTINUE WITH', 'YOKI DAVOM ETING', 'ИЛИ ПРОДОЛЖИТЕ ЧЕРЕЗ'],
    ['PASSWORD', 'PAROL', 'ПАРОЛЬ'],
    ['Remember me', 'Meni eslab qol', 'Запомнить меня'],
    ['Forgot password?', 'Parolni unutdingizmi?', 'Забыли пароль?'],
    ['Sign In →', 'Kirish →', 'Войти →'],
    ["Don't have an account?", "Akkauntingiz yo'qmi?", 'Нет аккаунта?'],
    ['Already have an account?', 'Akkauntingiz bormi?', 'Уже есть аккаунт?'],
    ['Create your account', 'Akkaunt yarating', 'Создайте аккаунт'],
    ['JOIN PENAURA', "PENAURAGA QO'SHILING", 'ПРИСОЕДИНЯЙТЕСЬ К PENAURA'],
    ["Tell us how you'd like to use Penaura — you can always do both later.", "Penauradan qanday foydalanmoqchisiz? Keyinroq ikkalasini ham tanlashingiz mumkin.", 'Расскажите, как вы хотите использовать Penaura — позже можно выбрать и то и другое.'],
    ["✒ I'm a Writer", '✒ Men yozuvchiman', '✒ Я писатель'],
    ["📖 I'm a Reader", "📖 Men o'quvchiman", '📖 Я читатель'],
    ['✒ WRITER', '✒ YOZUVCHI', '✒ ПИСАТЕЛЬ'],
    ['📖 READER', "📖 O'QUVCHI", '📖 ЧИТАТЕЛЬ'],
    ['FULL NAME', "TO'LIQ ISM", 'ПОЛНОЕ ИМЯ'],
    ['Your full name', "To'liq ismingiz", 'Ваше полное имя'],
    ['PHONE NUMBER', 'TELEFON RAQAMI', 'НОМЕР ТЕЛЕФОНА'],
    ['CONFIRM PASSWORD', 'PAROLNI TASDIQLANG', 'ПОДТВЕРДИТЕ ПАРОЛЬ'],
    ['I agree to the', 'Men quyidagilarga roziman:', 'Я принимаю'],
    ['Create Account →', 'Akkaunt yaratish →', 'Создать аккаунт →'],
    ['FORGOT PASSWORD', 'PAROLNI UNUTDINGIZMI', 'ЗАБЫЛИ ПАРОЛЬ'],
    ["Enter the email you signed up with and we'll send you a link to choose a new password.", "Ro'yxatdan o'tgan emailingizni kiriting, yangi parol tanlash uchun havola yuboramiz.", 'Введите email, с которым вы регистрировались, и мы отправим ссылку для выбора нового пароля.'],
    ['Send Reset Link →', 'Tiklash havolasini yuborish →', 'Отправить ссылку →'],
    ['Remembered it?', 'Esladingizmi?', 'Вспомнили?'],
    ['Reset your password', 'Parolni tiklang', 'Сброс пароля'],
    ['Choose a new password', 'Yangi parol tanlang', 'Выберите новый пароль'],
    ["Use at least 8 characters. You won't need your old password.", "Kamida 8 ta belgi ishlating. Eski parol endi kerak bo'lmaydi.", 'Не менее 8 символов. Старый пароль больше не понадобится.'],
    ['Update Password →', 'Parolni yangilash →', 'Обновить пароль →'],
    ['NEW PASSWORD', 'YANGI PAROL', 'НОВЫЙ ПАРОЛЬ'],
    ['CONFIRM NEW PASSWORD', 'YANGI PAROLNI TASDIQLANG', 'ПОДТВЕРДИТЕ НОВЫЙ ПАРОЛЬ'],
    ['Link expired?', 'Havola eskirdimi?', 'Ссылка устарела?'],
    ['Request a new one', "Yangisini so'rang", 'Запросите новую'],
    ['Verify your email', 'Emailingizni tasdiqlang', 'Подтвердите email'],
    ['ONE LAST STEP', 'OXIRGI QADAM', 'ПОСЛЕДНИЙ ШАГ'],
    ["We've sent a 4-digit code to", 'Biz 4 xonali kodni yubordik:', 'Мы отправили 4-значный код на'],
    ['. Enter it below to activate your account.', '. Akkauntni faollashtirish uchun uni quyiga kiriting.', '. Введите его ниже, чтобы активировать аккаунт.'],
    ['Verify & Continue →', 'Tasdiqlash va davom etish →', 'Подтвердить и продолжить →'],
    ["Didn't get a code?", 'Kod kelmadimi?', 'Не пришёл код?'],
    ['Resend it', 'Qayta yuborish', 'Отправить повторно'],

    // Sozlamalar
    ['Settings', 'Sozlamalar', 'Настройки'],
    ['⚙ Settings', '⚙ Sozlamalar', '⚙ Настройки'],
    ['General', 'Umumiy', 'Общие'],
    ['Profile', 'Profil', 'Профиль'],
    ['Language', 'Til', 'Язык'],
    ['Password & Security', 'Parol va xavfsizlik', 'Пароль и безопасность'],
    ['← Back to Profile', '← Profilga qaytish', '← В профиль'],
    ['Your name, photo and a short bio shown on your profile.', 'Profilingizda ko\'rinadigan ism, rasm va qisqa bio.', 'Имя, фото и краткая биография, отображаемые в вашем профиле.'],
    ['Change photo', 'Rasmni almashtirish', 'Изменить фото'],
    ['CITY', 'SHAHAR', 'ГОРОД'],
    ['BIO / ABOUT YOU', "BIO / O'ZINGIZ HAQINGIZDA", 'О СЕБЕ'],
    ['Save Profile', 'Profilni saqlash', 'Сохранить профиль'],
    ["Choose the language you'd like to use across Penaura.", "Penaurada foydalanmoqchi bo'lgan tilni tanlang.", 'Выберите язык интерфейса Penaura.'],
    ['Change Password', "Parolni o'zgartirish", 'Изменить пароль'],
    ["Choose a strong password you don't use elsewhere.", "Boshqa joyda ishlatmaydigan kuchli parol tanlang.", 'Выберите надёжный пароль, который вы нигде не используете.'],
    ['CURRENT PASSWORD', 'JORIY PAROL', 'ТЕКУЩИЙ ПАРОЛЬ'],
    ['Forgot your current password?', 'Joriy parolni unutdingizmi?', 'Забыли текущий пароль?'],
    ['Update Password', 'Parolni yangilash', 'Обновить пароль'],
    ['Danger Zone', 'Xavfli hudud', 'Опасная зона'],
    ['Delete My Account', "Akkauntimni o'chirish", 'Удалить мой аккаунт'],
    ['CONFIRM WITH YOUR PASSWORD', 'PAROL BILAN TASDIQLANG', 'ПОДТВЕРДИТЕ ПАРОЛЕМ'],
    ['Contact Information', "Aloqa ma'lumotlari", 'Контактная информация'],
    ['Used for account recovery and important notifications.', 'Akkauntni tiklash va muhim bildirishnomalar uchun ishlatiladi.', 'Используется для восстановления аккаунта и важных уведомлений.'],
    ['Save Changes', "O'zgarishlarni saqlash", 'Сохранить изменения'],
    ['Phone', 'Telefon', 'Телефон'],

    // Tangalar
    ['Penaura Coins', 'Penaura tangalari', 'Монеты Penaura'],
    ['AVAILABLE BALANCE', 'MAVJUD BALANS', 'ДОСТУПНЫЙ БАЛАНС'],
    ['Coin packages', 'Tanga paketlari', 'Пакеты монет'],
    ['How coins work', 'Tangalar qanday ishlaydi', 'Как работают монеты'],
    ['Order summary', 'Buyurtma xulosasi', 'Состав заказа'],
    ['Payment method', "To'lov usuli", 'Способ оплаты'],
    ['Continue to payment', "To'lovga o'tish", 'Перейти к оплате'],
    ['Total due', "Jami to'lov", 'К оплате'],
    ['Total coins', 'Jami tangalar', 'Всего монет'],
    ['Bonus coins', 'Bonus tangalar', 'Бонусные монеты'],
    ['Purchase', 'Xarid', 'Покупка'],
    ['Review your purchase', "Xaridni ko'rib chiqing", 'Проверьте покупку'],
    ['COIN CHECKOUT', 'TANGA XARIDI', 'ОФОРМЛЕНИЕ МОНЕТ'],
    ['← Back to coin packages', '← Tanga paketlariga qaytish', '← К пакетам монет'],
    ['Coin Store — Penaura', "Tanga do'koni — Penaura", 'Магазин монет — Penaura'],
    ['Coin Checkout — Penaura', 'Tanga xaridi — Penaura', 'Оформление монет — Penaura'],

    // Profil
    ['MEMBER SINCE', "A'ZO BO'LGAN SANA", 'УЧАСТНИК С'],
    ['WRITERS FOLLOWED', 'KUZATILAYOTGAN YOZUVCHILAR', 'ПОДПИСКИ НА АВТОРОВ'],
    ['CHAPTERS UNLOCKED', 'OCHILGAN BOBLAR', 'ОТКРЫТЫЕ ГЛАВЫ'],
    ['LIKED', 'YOQQANLAR', 'ПОНРАВИЛОСЬ'],
    ['FOLLOWERS', 'OBUNACHILAR', 'ПОДПИСЧИКИ'],
    ['READS', "O'QILGAN", 'ПРОЧТЕНИЯ'],
    ['STORIES', 'HIKOYALAR', 'РАССКАЗЫ'],
    ['WORKS', 'ASARLAR', 'ПРОИЗВЕДЕНИЯ'],
    ['PUBLISHED WORKS', 'NASHR QILINGAN ASARLAR', 'ОПУБЛИКОВАННЫЕ РАБОТЫ'],
    ['My Works', 'Asarlarim', 'Мои работы'],
    ['My Books', 'Kitoblarim', 'Мои книги'],
    ['Draft', 'Qoralama', 'Черновик'],
    ['Published', 'Nashr qilingan', 'Опубликовано'],
    ['+ New Story', '+ Yangi hikoya', '+ Новая история'],

    // Sahifa sarlavhalari ("... — Penaura" qoidasi bilan ishlaydi)
    ['Settings — Penaura', 'Sozlamalar — Penaura', 'Настройки — Penaura'],
    ['Sign In — Penaura', 'Kirish — Penaura', 'Вход — Penaura'],
    ['Sign Up — Penaura', "Ro'yxatdan o'tish — Penaura", 'Регистрация — Penaura'],
    ['Fiction — Penaura', 'Nasr — Penaura', 'Проза — Penaura'],
    ['Poetry — Penaura', "She'riyat — Penaura", 'Поэзия — Penaura'],
    ['Blog — Penaura', 'Blog — Penaura', 'Блог — Penaura'],
    ['About — Penaura', 'Biz haqimizda — Penaura', 'О нас — Penaura'],
    ['My Books — Penaura', 'Kitoblarim — Penaura', 'Мои книги — Penaura'],
    ['Forgot Password — Penaura', 'Parolni unutdim — Penaura', 'Забыли пароль — Penaura'],
    ['Reset Password — Penaura', 'Parolni tiklash — Penaura', 'Сброс пароля — Penaura'],
    ['Verify Email — Penaura', 'Emailni tasdiqlash — Penaura', 'Подтверждение email — Penaura'],
    ['My Profile — Penaura', 'Profilim — Penaura', 'Мой профиль — Penaura'],

    // Blog sahifasi
    ['The Penaura Blog', 'Penaura Blogi', 'Блог Penaura'],
    ['Writing tips, author interviews, and news from the Penaura team — for writers building their craft and readers who love the process behind the page.', "Yozish maslahatlari, mualliflar bilan intervyular va Penaura jamoasidan yangiliklar — mahoratini oshirayotgan yozuvchilar va sahifa ortidagi jarayonni sevadigan o'quvchilar uchun.", 'Советы по письму, интервью с авторами и новости команды Penaura — для писателей, оттачивающих мастерство, и читателей, которые любят процесс создания книги.'],
    ['Writing Tips', 'Yozish maslahatlari', 'Советы по письму'],
    ['Author Interview', 'Muallif intervyusi', 'Интервью с автором'],
    ['Community', 'Hamjamiyat', 'Сообщество'],
    ['Platform News', 'Platforma yangiliklari', 'Новости платформы'],
    ['WRITING TIPS', 'YOZISH MASLAHATLARI', 'СОВЕТЫ ПО ПИСЬМУ'],
    ['AUTHOR INTERVIEW', 'MUALLIF INTERVYUSI', 'ИНТЕРВЬЮ С АВТОРОМ'],
    ['PUBLISHING GUIDE', "NASHR QO'LLANMASI", 'РУКОВОДСТВО ПО ПУБЛИКАЦИИ'],
    ['COMMUNITY', 'HAMJAMIYAT', 'СООБЩЕСТВО'],
    ['PLATFORM NEWS', 'PLATFORMA YANGILIKLARI', 'НОВОСТИ ПЛАТФОРМЫ'],

    // Bosh sahifa, Nasr, Biz haqimizda, Tangalar, Yuklash va boshqa sahifalar
    ["STORIES DESERVE TO BE HEARD", "HIKOYALAR ESHITILISHGA LOYIQ", "ИСТОРИИ ДОСТОЙНЫ ТОГО, ЧТОБЫ ИХ УСЛЫШАЛИ"],
    ["Where Untold Stories", "Aytilmagan hikoyalar", "Нерассказанные истории"],
    ["Come to", "jonlanadigan", "оживают"],
    ["Find stories that move you — waiting to be read, yet to be discovered. Penaura is where new writers find their first readers, and readers discover their next favorite author.", "Sizni larzaga soladigan hikoyalarni toping — o'qilishini kutayotgan, hali kashf etilmagan hikoyalar. Penaura — yangi yozuvchilar ilk o'quvchilarini, o'quvchilar esa keyingi sevimli muallifini topadigan joy.", "Находите истории, которые трогают душу, — те, что ждут своих читателей и ещё не открыты. Penaura — место, где новые авторы находят первых читателей, а читатели открывают своего следующего любимого автора."],
    ["READERS", "O'QUVCHILAR", "ЧИТАТЕЛИ"],
    ["Novels, novellas, and short stories from Penaura's writers — historical epics, quiet literary portraits, mysteries, and everything in between.", "Penaura yozuvchilarining romanlari, qissalari va hikoyalari — tarixiy dostonlar, sokin adabiy portretlar, detektivlar va ular orasidagi hamma narsa.", "Романы, повести и рассказы авторов Penaura — исторические эпопеи, тихие литературные портреты, детективы и всё, что между ними."],
    ["OUR STORY", "BIZNING HIKOYA", "НАША ИСТОРИЯ"],
    ["Penaura started with a simple frustration: too many good stories were sitting in drawers, never read by anyone. We built a place where new writers can publish without gatekeepers, and readers can discover voices before the rest of the world does.", "Penaura oddiy bir norozilikdan boshlandi: juda ko'p yaxshi hikoyalar tortmalarda yotardi va hech kim o'qimasdi. Biz yangi yozuvchilar darvozabonlarsiz nashr qila oladigan, o'quvchilar esa ovozlarni boshqalardan oldin kashf eta oladigan joy yaratdik.", "Penaura началась с простой досады: слишком много хороших историй лежало в ящиках, и никто их не читал. Мы создали место, где новые авторы могут публиковаться без «привратников», а читатели — открывать новые голоса раньше остального мира."],
    ["HOW IT STARTED", "QANDAY BOSHLANGAN", "С ЧЕГО ВСЁ НАЧАЛОСЬ"],
    ["Built by writers, for writers", "Yozuvchilar tomonidan, yozuvchilar uchun yaratilgan", "Создано писателями для писателей"],
    ["Penaura began in 2024 when our founder, a self-published poet, realized how hard it was for new writers in Central Asia to find an audience — or get paid for their work.", "Penaura 2024-yilda, asoschimiz — o'zi nashr qilgan shoir — Markaziy Osiyodagi yangi yozuvchilar uchun o'z auditoriyasini topish yoki ishi uchun haq olish naqadar qiyinligini anglaganida boshlandi.", "Penaura появилась в 2024 году, когда наш основатель, самиздатовский поэт, осознал, как трудно начинающим авторам Центральной Азии найти аудиторию или получать оплату за свой труд."],
    ["What started as a small blog for friends' short stories has grown into a home for thousands of writers, from teenagers publishing their first poem to novelists building a loyal readership one chapter at a time.", "Do'stlar uchun kichik hikoyalar blogi sifatida boshlangan loyiha minglab yozuvchilar uchun uyga aylandi: birinchi she'rini e'lon qilayotgan o'smirlardan tortib, bob-bob sodiq o'quvchilar to'playotgan romanchilargacha.", "То, что начиналось как маленький блог с рассказами для друзей, выросло в дом для тысяч авторов — от подростков, публикующих первое стихотворение, до романистов, глава за главой собирающих верных читателей."],
    ["OUR MISSION", "BIZNING MAQSAD", "НАША МИССИЯ"],
    ["Discovery over algorithms", "Algoritmlardan ko'ra kashfiyot", "Открытия важнее алгоритмов"],
    ["Most platforms bury new writers under content that's already popular. We do the opposite — our Featured Works and Author Spotlight are chosen by real readers and editors, not just view counts.", "Ko'pchilik platformalar yangi yozuvchilarni allaqachon mashhur kontent ostida ko'mib tashlaydi. Biz aksincha qilamiz — Tanlangan asarlar va Muallif diqqat markazida bo'limlarini ko'rishlar soni emas, haqiqiy o'quvchilar va tahrirchilar tanlaydi.", "Большинство платформ хоронят новых авторов под уже популярным контентом. Мы делаем наоборот — «Избранные работы» и «Автор в центре внимания» выбирают настоящие читатели и редакторы, а не просто количество просмотров."],
    ["We want the next great voice to be found because their writing is good, not because they already had 10,000 followers.", "Biz keyingi buyuk ovoz yozgani yaxshi bo'lgani uchun topilishini xohlaymiz, 10 000 ta obunachisi bo'lgani uchun emas.", "Мы хотим, чтобы следующий большой голос заметили за хороший текст, а не за то, что у него уже 10 000 подписчиков."],
    ["What we believe", "Biz nimaga ishonamiz", "Во что мы верим"],
    ["Every voice matters", "Har bir ovoz muhim", "Каждый голос важен"],
    ["Whether it's your first poem or your fiftieth novel, we believe every story deserves a fair chance to find its readers.", "Birinchi she'ringiz bo'ladimi yoki ellikinchi romaningiz — har bir hikoya o'z o'quvchilarini topish uchun adolatli imkoniyatga loyiq, deb ishonamiz.", "Будь то ваше первое стихотворение или пятидесятый роман — мы верим, что каждая история заслуживает честного шанса найти своих читателей."],
    ["Writers come first", "Avvalo yozuvchilar", "Писатели на первом месте"],
    ["Our tools, our featured spots, and our roadmap are all built around one question: does this help writers grow?", "Bizning vositalarimiz, tanlangan o'rinlarimiz va yo'l xaritamiz bitta savolga qurilgan: bu yozuvchilarning o'sishiga yordam beradimi?", "Наши инструменты, избранные места и дорожная карта строятся вокруг одного вопроса: помогает ли это авторам расти?"],
    ["Quality over noise", "Shovqin emas, sifat", "Качество важнее шума"],
    ["We'd rather help you write one story that resonates than a hundred that get lost in the scroll.", "Biz sizga tasma ichida yo'qolib ketadigan yuzta hikoyadan ko'ra, o'quvchi qalbiga yetib boradigan bitta hikoya yozishga yordam berishni afzal ko'ramiz.", "Мы лучше поможем вам написать одну историю, которая отзовётся, чем сто, которые потеряются в ленте."],
    ["STORIES PUBLISHED", "NASHR QILINGAN HIKOYALAR", "ОПУБЛИКОВАННЫЕ ИСТОРИИ"],
    ["MONTHLY READERS", "OYLIK O'QUVCHILAR", "ЧИТАТЕЛЕЙ В МЕСЯЦ"],
    ["FOUNDED", "TASHKIL ETILGAN", "ОСНОВАНО"],
    ["The team behind Penaura", "Penaura ortidagi jamoa", "Команда Penaura"],
    ["Founder & CEO", "Asoschi va bosh direktor", "Основатель и генеральный директор"],
    ["Head of Product", "Mahsulot rahbari", "Руководитель продукта"],
    ["Editorial Lead", "Tahririyat rahbari", "Руководитель редакции"],
    ["Community Manager", "Hamjamiyat menejeri", "Менеджер сообщества"],
    ["Join thousands of writers who've already started sharing their stories on Penaura.", "Hikoyalarini Penaura'da ulashishni boshlagan minglab yozuvchilarga qo'shiling.", "Присоединяйтесь к тысячам авторов, которые уже делятся своими историями на Penaura."],
    ["GET IN TOUCH", "BIZ BILAN BOG'LANING", "СВЯЖИТЕСЬ С НАМИ"],
    ["We'd love to hear from you", "Sizdan eshitsak xursand bo'lamiz", "Мы будем рады услышать вас"],
    ["Questions about Penaura, publishing, or your account? Send us a note or give us a call.", "Penaura, nashr yoki hisobingiz haqida savollaringiz bormi? Bizga xabar yozing yoki qo'ng'iroq qiling.", "Есть вопросы о Penaura, публикации или вашем аккаунте? Напишите нам или позвоните."],
    ["Email", "Email", "Эл. почта"],
    ["Sample contact details; replace before publishing.", "Namuna aloqa ma'lumotlari; nashr qilishdan oldin almashtiring.", "Образец контактных данных; замените перед публикацией."],
    ["Choose a payment method for your Penaura coins.", "Penaura tangalari uchun to'lov usulini tanlang.", "Выберите способ оплаты монет Penaura."],
    ["Uzbekistan payment service", "O'zbekiston to'lov xizmati", "Платёжный сервис Узбекистана"],
    ["You will continue to the selected provider after payment integration is connected.", "To'lov integratsiyasi ulangach, tanlangan provayderga o'tasiz.", "После подключения платёжной интеграции вы перейдёте к выбранному провайдеру."],
    ["Coins", "Tangalar", "Монеты"],
    ["Your balance will only change after a confirmed payment.", "Balansingiz faqat to'lov tasdiqlangandan keyin o'zgaradi.", "Ваш баланс изменится только после подтверждения платежа."],
    ["Use coins to unlock chapters early, before they're free for everyone. New chapters release weekly — coins let you keep reading without the wait.", "Boblarni hamma uchun bepul bo'lishidan oldin ochish uchun tangalardan foydalaning. Yangi boblar har hafta chiqadi — tangalar kutmasdan o'qishda davom etishga imkon beradi.", "Используйте монеты, чтобы открывать главы раньше, чем они станут бесплатными для всех. Новые главы выходят каждую неделю — монеты позволяют читать без ожидания."],
    ["YOUR CURRENT BALANCE", "HOZIRGI BALANSINGIZ", "ВАШ ТЕКУЩИЙ БАЛАНС"],
    ["MOST POPULAR", "ENG MASHHUR", "САМЫЙ ПОПУЛЯРНЫЙ"],
    ["Every story's first chapters are free. New chapters release weekly for everyone.", "Har bir hikoyaning dastlabki boblari bepul. Yangi boblar har hafta hamma uchun chiqadi.", "Первые главы каждой истории бесплатны. Новые главы выходят каждую неделю для всех."],
    ["Don't want to wait a week? Spend 1 coin to unlock the next chapter right now.", "Bir hafta kutishni xohlamaysizmi? Keyingi bobni hoziroq ochish uchun 1 tanga sarflang.", "Не хотите ждать неделю? Потратьте 1 монету, чтобы открыть следующую главу прямо сейчас."],
    ["Coins never expire — use them whenever a story is worth skipping the wait for.", "Tangalar muddati tugamaydi — kutishni o'tkazib yuborishga arziydigan hikoya topilganda ishlating.", "Монеты не сгорают — используйте их, когда история стоит того, чтобы не ждать."],
    ["Edit Chapter — Penaura", "Bobni tahrirlash — Penaura", "Редактирование главы — Penaura"],
    ["Ready", "Tayyor", "Готово"],
    ["Chapter Title (e.g. The Departure)", "Bob sarlavhasi (masalan, Jo'nash)", "Название главы (например, Отъезд)"],
    ["Bold", "Qalin", "Жирный"],
    ["Italic", "Kursiv", "Курсив"],
    ["Heading", "Sarlavha", "Заголовок"],
    ["Quote", "Iqtibos", "Цитата"],
    ["List", "Ro'yxat", "Список"],
    ["📄 Import Docs", "📄 Docs import qilish", "📄 Импорт документа"],
    ["Start writing, or paste in your chapter text here...", "Yozishni boshlang yoki bob matnini shu yerga qo'ying...", "Начните писать или вставьте текст главы сюда..."],
    ["Chapter Info", "Bob haqida", "О главе"],
    ["Word count", "So'zlar soni", "Количество слов"],
    ["Last saved", "Oxirgi saqlash", "Последнее сохранение"],
    ["Never", "Hech qachon", "Никогда"],
    ["Access Type", "Kirish turi", "Тип доступа"],
    ["⭐ Premium", "⭐ Premium", "⭐ Премиум"],
    ["Publishing", "Nashr", "Публикация"],
    ["Publish Chapter", "Bobni nashr qilish", "Опубликовать главу"],
    ["Save Draft", "Qoralamani saqlash", "Сохранить черновик"],
    ["All changes saved", "Barcha o'zgarishlar saqlandi", "Все изменения сохранены"],
    ["Unsaved changes...", "Saqlanmagan o'zgarishlar...", "Несохранённые изменения..."],
    ["(for contact only)", "(faqat aloqa uchun)", "(только для связи)"],
    ["Deleting your account is permanent and cannot be undone. Your profile, follows and reading progress will be removed.", "Hisobni o'chirish qaytarib bo'lmaydi. Profilingiz, kuzatuvlaringiz va o'qish jarayoningiz o'chiriladi.", "Удаление аккаунта необратимо. Ваш профиль, подписки и прогресс чтения будут удалены."],
    ["All the stories you've started. Open a book to manage its chapters, or start something new.", "Siz boshlagan barcha hikoyalar. Boblarini boshqarish uchun kitobni oching yoki yangisini boshlang.", "Все истории, которые вы начали. Откройте книгу, чтобы управлять главами, или начните новую."],
    ["BOOKS STARTED", "BOSHLANGAN KITOBLAR", "НАЧАТО КНИГ"],
    ["TOTAL READS", "JAMI O'QILGAN", "ВСЕГО ПРОЧТЕНИЙ"],
    ["AVERAGE RATING", "O'RTACHA BAHO", "СРЕДНЯЯ ОЦЕНКА"],
    ["+ Upload new →", "+ Yangisini yuklash →", "+ Загрузить новое →"],
    ["comments", "izohlar", "комментарии"],
    ["Stats", "Statistika", "Статистика"],
    ["Not published yet", "Hali nashr qilinmagan", "Ещё не опубликовано"],
    ["In review", "Ko'rib chiqilmoqda", "На рассмотрении"],
    ["Top rated", "Eng yuqori baholangan", "С самым высоким рейтингом"],
    ["Read →", "O'qish →", "Читать →"],
    ["Upload a Story — Penaura", "Hikoya yuklash — Penaura", "Загрузка истории — Penaura"],
    ["Start a New Book", "Yangi kitob boshlash", "Начать новую книгу"],
    ["Set up your book's details first — you'll add chapters one by one from the book's page.", "Avval kitobingiz ma'lumotlarini kiriting — boblarni keyin kitob sahifasidan birma-bir qo'shasiz.", "Сначала заполните данные книги — главы вы будете добавлять по одной со страницы книги."],
    ["WHAT ARE YOU CREATING?", "NIMA YARATMOQDASIZ?", "ЧТО ВЫ СОЗДАЁТЕ?"],
    ["Write a standalone poem", "Alohida she'r yozish", "Написать отдельное стихотворение"],
    ["Chaptered book", "Boblarga bo'lingan kitob", "Книга с главами"],
    ["Add chapters separately", "Boblarni alohida qo'shish", "Добавлять главы отдельно"],
    ["Short story", "Qisqa hikoya", "Короткий рассказ"],
    ["Write and publish it in one part", "Bir qismda yozib, nashr qilish", "Написать и опубликовать одной частью"],
    ["BOOK TITLE", "KITOB NOMI", "НАЗВАНИЕ КНИГИ"],
    ["Give your story a title", "Hikoyangizga nom bering", "Дайте истории название"],
    ["GENRE", "JANR", "ЖАНР"],
    ["Historical Fiction", "Tarixiy nasr", "Историческая проза"],
    ["Personal Essay", "Shaxsiy esse", "Личное эссе"],
    ["POEM TOPIC", "SHE'R MAVZUSI", "ТЕМА СТИХОТВОРЕНИЯ"],
    ["SHORT DESCRIPTION", "QISQACHA TAVSIF", "КРАТКОЕ ОПИСАНИЕ"],
    ["Write a short, compelling description that makes readers want to click...", "O'quvchini bosishga undaydigan qisqa va qiziqarli tavsif yozing...", "Напишите короткое увлекательное описание, чтобы читателю захотелось нажать..."],
    ["STORY TITLE *", "HIKOYA NOMI", "НАЗВАНИЕ РАССКАЗА"],
    ["Short story title", "Qisqa hikoya nomi", "Название рассказа"],
    ["STORY TEXT *", "HIKOYA MATNI", "ТЕКСТ РАССКАЗА"],
    ["Write your complete short story...", "Qisqa hikoyangizni to'liq yozing...", "Напишите свой рассказ целиком..."],
    ["TAGS", "TEGLAR", "ТЕГИ"],
    ["Type tag and press Enter or comma...", "Teg yozing va Enter yoki vergul bosing...", "Введите тег и нажмите Enter или запятую..."],
    ["Press Enter or comma to add tags", "Teg qo'shish uchun Enter yoki vergul bosing", "Нажмите Enter или запятую, чтобы добавить теги"],
    ["Cover Image", "Muqova rasmi", "Обложка"],
    ["A good cover helps readers discover your story.", "Yaxshi muqova o'quvchilarga hikoyangizni topishda yordam beradi.", "Хорошая обложка помогает читателям найти вашу историю."],
    ["Upload cover", "Muqovani yuklash", "Загрузить обложку"],
    ["(portrait, 2:3 ratio)", "(portret, 2:3 nisbat)", "(портрет, соотношение 2:3)"],
    ["Publishing Status", "Nashr holati", "Статус публикации"],
    ["Choose your book visibility.", "Kitobingiz ko'rinishini tanlang.", "Выберите видимость книги."],
    ["Continue to Add Chapters →", "Boblar qo'shishga o'tish →", "Перейти к добавлению глав →"],
    ["Save as Draft", "Qoralama sifatida saqlash", "Сохранить как черновик"],
    ["POEM TITLE", "SHE'R NOMI", "НАЗВАНИЕ СТИХОТВОРЕНИЯ"],
    ["Write a New Poem", "Yangi she'r yozish", "Написать новое стихотворение"],
    ["Write a Short Story", "Qisqa hikoya yozish", "Написать короткий рассказ"],
    ["Write and publish a poem directly — no chapters needed.", "She'rni to'g'ridan-to'g'ri yozib nashr qiling — boblar kerak emas.", "Пишите и публикуйте стихотворение сразу — главы не нужны."],
    ["Write the complete story in one part and publish it as a finished work.", "Hikoyani bir qismda to'liq yozing va tugallangan asar sifatida nashr qiling.", "Напишите рассказ целиком одной частью и опубликуйте как законченное произведение."],
    ["POEM TEXT", "SHE'R MATNI", "ТЕКСТ СТИХОТВОРЕНИЯ"],
    ["Give your poem a title", "She'ringizga nom bering", "Дайте стихотворению название"],
    ["Give your book a title", "Kitobingizga nom bering", "Дайте книге название"],
    ["Write your poem here...", "She'ringizni shu yerga yozing...", "Напишите стихотворение здесь..."],
    ["Choose whether to publish your poem now or keep it as a draft.", "She'rni hozir nashr qilish yoki qoralama sifatida saqlashni tanlang.", "Выберите: опубликовать стихотворение сейчас или сохранить как черновик."],
    ["Choose whether to publish your complete story or save it as a draft.", "Hikoyani nashr qilish yoki qoralama sifatida saqlashni tanlang.", "Выберите: опубликовать рассказ или сохранить как черновик."],
    ["Save Poem Draft", "She'r qoralamasini saqlash", "Сохранить черновик стихотворения"],
    ["Publish Poem →", "She'rni nashr qilish →", "Опубликовать стихотворение →"],
    ["Save Story Draft", "Hikoya qoralamasini saqlash", "Сохранить черновик рассказа"],
    ["Publish Story →", "Hikoyani nashr qilish →", "Опубликовать рассказ →"],
    ["Manage Book — Penaura", "Kitobni boshqarish — Penaura", "Управление книгой — Penaura"],
    ["Book Title", "Kitob nomi", "Название книги"],
    ["Close reading preview", "O'qish ko'rinishini yopish", "Закрыть предпросмотр чтения"],
    ["Chapter navigation", "Boblar bo'ylab harakatlanish", "Навигация по главам"],
    ["Search by book title", "Kitob nomi bo'yicha qidirish", "Поиск по названию книги"],
    ["Search books", "Kitoblarni qidirish", "Поиск книг"],
    ["Book title", "Kitob nomi", "Название книги"],
    ['Life (headline)', 'makon', 'здесь'],
    ["reads", "o'qilgan", "прочтений"],
    ["Travel Essay", "Sayohat essesi", "Путевой очерк"],
    ["Poetry Review", "She'riyat sharhi", "Обзор поэзии"],
    ["Writing Craft", "Yozuvchilik mahorati", "Писательское мастерство"],
  ];

  /* ---------- Lug'at: asl matn o'zbekcha (saved sahifasi, nav) ---------- */
  const UZ = [
    ['Saqlanganlar', 'Saved', 'Сохранённое'],
    ['Saqlanganlar — Penaura', 'Saved — Penaura', 'Сохранённое — Penaura'],
    ["Keyin o'qish uchun saqlab qo'ygan kitob va she'rlaringiz shu yerda turadi.", "Books and poems you've saved to read later are kept here.", 'Здесь хранятся книги и стихи, сохранённые на потом.'],
    ['Kitoblar', 'Books', 'Книги'],
    ["She'rlar", 'Poems', 'Стихи'],
    ['Yuklanmoqda…', 'Loading…', 'Загрузка…'],
    ['Hali hech narsa saqlamagansiz', "You haven't saved anything yet", 'Вы пока ничего не сохранили'],
    ["Kitoblarni ko'rish →", 'Browse books →', 'Смотреть книги →'],
    ["She'rlarni ko'rish →", 'Browse poems →', 'Смотреть стихи →'],
    ["Saqlangan kitob yo'q", 'No saved books', 'Нет сохранённых книг'],
    ["Saqlangan she'r yo'q", 'No saved poems', 'Нет сохранённых стихов'],
    ["Kitob sahifasidagi Save tugmasi bilan saqlang.", 'Save a book with the Save button on its page.', 'Сохраните книгу кнопкой «Сохранить» на её странице.'],
    ["She'r kartochkasidagi Bookmark tugmasi bilan saqlang.", "Save a poem with the Bookmark button on its card.", 'Сохраните стихотворение кнопкой закладки на его карточке.'],
    ["Saqlanganlarni ko'rish uchun tizimga kiring", 'Sign in to see your saved items', 'Войдите, чтобы увидеть сохранённое'],
    ["Saqlagan kitob va she'rlaringiz hisobingizga bog'langan.", 'Your saved books and poems are linked to your account.', 'Сохранённые книги и стихи привязаны к вашему аккаунту.'],
    ["Yuklab bo'lmadi", "Couldn't load", 'Не удалось загрузить'],
    ['Saqlanganlardan olib tashlash', 'Remove from saved', 'Убрать из сохранённого'],
    ['Saqlash', 'Save', 'Сохранить'],
    ["Maqolalarni yuklab bo'lmadi. Keyinroq qayta urinib ko'ring.", 'Could not load the articles. Please try again later.', 'Не удалось загрузить статьи. Попробуйте позже.'],
    ["Hozircha maqolalar yo'q", 'No articles yet', 'Статей пока нет'],
    ['Bu toifada maqolalar topilmadi', 'No articles found in this category', 'В этой категории статей не найдено'],
    ['Maqola topilmadi', 'Article not found', 'Статья не найдена'],
    ["Maqolani yuklab bo'lmadi", "Couldn't load the article", 'Не удалось загрузить статью'],
    ['Bu maqola mavjud emas yoki blogdan olib tashlangan.', 'This article does not exist or has been removed from the blog.', 'Эта статья не существует или удалена из блога.'],
    ["Server bilan aloqa yo'q. Keyinroq qayta urinib ko'ring.", 'No connection to the server. Please try again later.', 'Нет связи с сервером. Попробуйте позже.'],
    // JS xabarlari va backend javoblari
    ["Platformadagi barcha yozuvchilarning kitoblari va hikoyalari", "Books and stories by all writers on the platform", "Книги и истории всех авторов платформы"],
    ["Barcha hikoyalar yuklanmoqda...", "Loading all stories...", "Загружаем все истории..."],
    ["Bu nomdagi asar topilmadi", "No work found with that title", "Работ с таким названием не найдено"],
    ["Bu janrda hali asar yo'q", "No works in this genre yet", "В этом жанре пока нет работ"],
    ["Hozircha nashr qilingan asarlar yo'q", "No published works yet", "Опубликованных работ пока нет"],
    ["Boshqa nomni sinab ko'ring.", "Try a different title.", "Попробуйте другое название."],
    ["Birinchi bo'lib asar yaratishingiz mumkin!", "You can be the first to create a work!", "Вы можете первым создать работу!"],
    ["+ Birinchi asarni yuklash", "+ Upload the first work", "+ Загрузить первую работу"],
    ["Kuzatib bo'lmadi.", "Couldn't follow.", "Не удалось подписаться."],
    ["Iltimos, to'g'ri email manzilini kiriting.", "Please enter a valid email address.", "Введите корректный адрес email."],
    ["Obuna bo'lindi ✓", "Subscribed ✓", "Вы подписаны ✓"],
    ["Muallif", "Author", "Автор"],
    ["she'r", "poem", "стихотворение"],
    ["Kitoblarni yuklab bo'lmadi.", "Couldn't load the books.", "Не удалось загрузить книги."],
    ["Saqlab bo'lmadi.", "Couldn't save.", "Не удалось сохранить."],
    ["Package not found. Return to the coin store and choose a package.", "Paket topilmadi. Tangalar do'koniga qaytib, paketni tanlang.", "Пакет не найден. Вернитесь в магазин монет и выберите пакет."],
    ["Please sign in before continuing with a coin purchase.", "Tanga sotib olishni davom ettirishdan oldin tizimga kiring.", "Войдите в аккаунт, прежде чем продолжить покупку монет."],
    ["Bob topilmadi", "Chapter not found", "Глава не найдена"],
    ["Bunday nomli kitob yoki bob topilmadi.", "No book or chapter with this name was found.", "Книга или глава с таким названием не найдена."],
    ["← Mening Kitoblarim", "← My Books", "← Мои книги"],
    ["Word (.docx) yoki Matn faylini yuklash", "Upload a Word (.docx) or text file", "Загрузить файл Word (.docx) или текстовый файл"],
    ["Google Docs havolasidan import qilish", "Import from a Google Docs link", "Импорт по ссылке Google Docs"],
    ["Iltimos, bob sarlavhasini kiriting.", "Please enter a chapter title.", "Пожалуйста, введите название главы."],
    ["Tahririyatga yuborildi ✓", "Sent to the editorial team ✓", "Отправлено в редакцию ✓"],
    ["Saqlandi ✓", "Saved ✓", "Сохранено ✓"],
    ["Saqlashda xatolik yuz berdi.", "An error occurred while saving.", "При сохранении произошла ошибка."],
    ["Iltimos, email manzilingizni kiriting.", "Please enter your email address.", "Пожалуйста, введите ваш адрес email."],
    ["Havola yuborildi.", "The link has been sent.", "Ссылка отправлена."],
    ["So'rovni yuborib bo'lmadi.", "The request couldn't be sent.", "Не удалось отправить запрос."],
    ["Havola noto'g'ri. Emailingizdagi havolani to'liq oching yoki yangisini so'rang.", "The link is invalid. Open the full link from your email or request a new one.", "Ссылка недействительна. Откройте ссылку из письма полностью или запросите новую."],
    ["Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak.", "The new password must be at least 8 characters long.", "Новый пароль должен содержать не менее 8 символов."],
    ["Parollar bir-biriga mos kelmadi.", "The passwords do not match.", "Пароли не совпадают."],
    ["Parol yangilandi ✓ Kirish sahifasiga yo'naltirilmoqda...", "Password updated ✓ Redirecting to the sign-in page...", "Пароль обновлён ✓ Перенаправляем на страницу входа..."],
    ["Parolni yangilab bo'lmadi.", "The password couldn't be updated.", "Не удалось обновить пароль."],
    ["\"Docs / Word yuklash\"", "\"Upload Docs / Word\"", "«Загрузить Docs / Word»"],
    ["Iltimos, parolingizni kiriting.", "Please enter your password.", "Пожалуйста, введите пароль."],
    ["! Bosh sahifaga yo'naltirilmoqda...", "! Redirecting to the home page...", "! Перенаправляем на главную..."],
    ["Email yoki parol noto'g'ri.", "Incorrect email or password.", "Неверный email или пароль."],
    ["Davom etish uchun Shartlar va Maxfiylik siyosatiga rozilik bering.", "Please agree to the Terms and Privacy Policy to continue.", "Чтобы продолжить, примите Условия и Политику конфиденциальности."],
    ["Iltimos, to'liq ismingizni kiriting.", "Please enter your full name.", "Пожалуйста, введите ваше полное имя."],
    ["Iltimos, to'g'ri email formatini kiriting (masalan: user@example.com).", "Please enter a valid email format (e.g. user@example.com).", "Введите корректный формат email (например: user@example.com)."],
    ["Iltimos, parol kiriting.", "Please enter a password.", "Пожалуйста, введите пароль."],
    ["Parol kamida 8 ta belgidan iborat bo'lishi kerak.", "The password must be at least 8 characters long.", "Пароль должен содержать не менее 8 символов."],
    ["Kiritilgan parollar bir-biriga mos kelmadi.", "The entered passwords do not match.", "Введённые пароли не совпадают."],
    ["Ro'yxatdan o'tishda xatolik yuz berdi.", "An error occurred during registration.", "При регистрации произошла ошибка."],
    ["Muvaffaqiyatli ro'yxatdan o'tdingiz! Bosh sahifaga yo'naltirilmoqda...", "You have registered successfully! Redirecting to the home page...", "Вы успешно зарегистрированы! Перенаправляем на главную..."],
    ["Iltimos, 4 xonali tasdiqlash kodini to'liq kiriting.", "Please enter the full 4-digit verification code.", "Введите полный 4-значный код подтверждения."],
    ["🎉 Email manzilingiz muvaffaqiyatli tasdiqlandi!", "🎉 Your email address has been verified!", "🎉 Ваш адрес email подтверждён!"],
    ["Parolni yashirish", "Hide password", "Скрыть пароль"],
    ["Parolni ko'rsatish", "Show password", "Показать пароль"],
    ["JPG, PNG yoki WEBP, 2 MB gacha.", "JPG, PNG or WEBP, up to 2 MB.", "JPG, PNG или WEBP, до 2 МБ."],
    ["Email o'zgartirib bo'lmaydi.", "The email cannot be changed.", "Email изменить нельзя."],
    ["Iltimos, ismingizni kiriting.", "Please enter your name.", "Пожалуйста, введите ваше имя."],
    ["Profil saqlandi ✓", "Profile saved ✓", "Профиль сохранён ✓"],
    ["Hozirgi parolni kiriting.", "Enter your current password.", "Введите текущий пароль."],
    ["Yangi parol va tasdiqlash paroli mos kelmadi.", "The new password and confirmation do not match.", "Новый пароль и подтверждение не совпадают."],
    ["Parol yangilandi ✓", "Password updated ✓", "Пароль обновлён ✓"],
    ["Faqat JPG, PNG yoki WEBP rasm yuklang.", "Upload only a JPG, PNG or WEBP image.", "Загружайте только изображения JPG, PNG или WEBP."],
    ["Rasm hajmi 2 MB dan oshmasligi kerak.", "The image must not exceed 2 MB.", "Размер изображения не должен превышать 2 МБ."],
    ["Rasm yangilandi ✓", "Image updated ✓", "Изображение обновлено ✓"],
    ["Tasdiqlash uchun parolni kiriting.", "Enter your password to confirm.", "Введите пароль для подтверждения."],
    ["Haqiqatan ham hisobingizni butunlay o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.", "Do you really want to permanently delete your account? This cannot be undone.", "Вы действительно хотите навсегда удалить аккаунт? Это действие нельзя отменить."],
    ["Hisobingiz o'chirildi.", "Your account has been deleted.", "Ваш аккаунт удалён."],
    ["Kitoblarni yuklashda xatolik yuz berdi.", "An error occurred while loading the books.", "При загрузке книг произошла ошибка."],
    ["Hali birorta kitob o'qishni boshlamadingiz.", "You haven't started reading any book yet.", "Вы ещё не начали читать ни одной книги."],
    ["Siz hali birorta yozuvchini kuzatmayapsiz.", "You aren't following any writer yet.", "Вы пока не подписаны ни на одного автора."],
    ["Amalni bajarib bo'lmadi.", "The action couldn't be completed.", "Не удалось выполнить действие."],
    ["Profilni yuklashda xatolik yuz berdi.", "An error occurred while loading the profile.", "При загрузке профиля произошла ошибка."],
    ["Olib tashlab bo'lmadi.", "Couldn't remove it.", "Не удалось удалить."],
    ["Server bilan aloqa yo'q.", "No connection to the server.", "Нет связи с сервером."],
    ["Kitob topilmadi yoki hali nashr qilinmagan.", "The book was not found or has not been published yet.", "Книга не найдена или ещё не опубликована."],
    ["Layk qo'yib bo'lmadi.", "Couldn't like it.", "Не удалось поставить лайк."],
    ["Bobni ochib bo'lmadi.", "Couldn't open the chapter.", "Не удалось открыть главу."],
    ["Kitob ko'rsatilmagan.", "No book specified.", "Книга не указана."],
    ["Baholash va saqlash uchun avval tizimga kiring.", "Sign in first to rate and save.", "Войдите, чтобы оценивать и сохранять."],
    ["Bahoni saqlab bo'lmadi.", "Couldn't save the rating.", "Не удалось сохранить оценку."],
    ["Bu mavzuda hali she'r yo'q", "No poems on this topic yet", "По этой теме пока нет стихотворений"],
    ["Hozircha nashr qilingan she'rlar yo'q", "No published poems yet", "Опубликованных стихотворений пока нет"],
    ["Saqlash (Bookmark)", "Save (Bookmark)", "Сохранить (закладка)"],
    ["She'rlarni yuklab bo'lmadi.", "Couldn't load the poems.", "Не удалось загрузить стихотворения."],
    ["Lirik she'rlar", "Lyric poems", "Лирические стихи"],
    ["Fantastika", "Fantasy", "Фантастика"],
    ["Tarixiy roman", "Historical novel", "Исторический роман"],
    ["She'riy doston", "Narrative poem", "Поэма"],
    ["Iltimos, rasm formatidagi fayl tanlang.", "Please choose an image file.", "Выберите файл изображения."],
    ["Kitob yaratish uchun avval tizimga kiring. Kirish sahifasiga yo'naltirilmoqda...", "Sign in first to create a book. Redirecting to the sign-in page...", "Войдите, чтобы создать книгу. Перенаправляем на страницу входа..."],
    ["Iltimos, she'r sarlavhasini kiriting.", "Please enter the poem title.", "Введите название стихотворения."],
    ["Iltimos, hikoya sarlavhasini kiriting.", "Please enter the story title.", "Введите название рассказа."],
    ["Iltimos, kitob sarlavhasini kiriting.", "Please enter the book title.", "Введите название книги."],
    ["Iltimos, she'r matnini yozing.", "Please write the poem text.", "Напишите текст стихотворения."],
    ["Iltimos, hikoya matnini yozing.", "Please write the story text.", "Напишите текст рассказа."],
    ["Iltimos, kitob haqida qisqacha tavsif yozing.", "Please write a short description of the book.", "Напишите краткое описание книги."],
    ["She'r qoralama sifatida saqlandi.", "The poem was saved as a draft.", "Стихотворение сохранено как черновик."],
    ["She'r tahririyatga yuborildi. Tahrirchi nashr qilgach, She'riyat sahifasida chiqadi.", "The poem was sent to the editors. It will appear on the Poetry page once an editor publishes it.", "Стихотворение отправлено редакторам. После публикации оно появится на странице «Поэзия»."],
    ["She'rni saqlashda xatolik yuz berdi:", "An error occurred while saving the poem:", "При сохранении стихотворения произошла ошибка:"],
    ["Hikoya tahririyatga yuborildi!", "The story was sent to the editors!", "Рассказ отправлен редакторам!"],
    ["Kitob saqlandi! Boblar sahifasiga yo'naltirilmoqda...", "Book saved! Redirecting to the chapters page...", "Книга сохранена! Перенаправляем на страницу глав..."],
    ["Xatolik yuz berdi:", "An error occurred:", "Произошла ошибка:"],
    ["Kitob topilmadi", "Book not found", "Книга не найдена"],
    ["Bunday nomli kitob mavjud emas yoki o'chirilgan bo'lishi mumkin.", "There is no book with this name, or it may have been deleted.", "Книги с таким названием нет, либо она могла быть удалена."],
    ["+ Yangi bob qo'shish", "+ Add a new chapter", "+ Добавить новую главу"],
    ["✍️ Qo'lda yozish", "✍️ Write manually", "✍️ Написать вручную"],
    ["📁 Docs / Word yuklash", "📁 Upload Docs / Word", "📁 Загрузить Docs / Word"],
    ["Word (.docx), Matn (.txt, .md) faylni bu yerga tashlang", "Drop a Word (.docx) or text (.txt, .md) file here", "Перетащите сюда файл Word (.docx) или текст (.txt, .md)"],
    ["yoki kompyuteringizdan tanlang. Bob sarlavhasi va matni avtomatik o'qib olinadi.", "or choose it from your computer. The chapter title and text are read automatically.", "или выберите его на компьютере. Название и текст главы считываются автоматически."],
    ["Faylni tanlash 📁", "Choose a file 📁", "Выбрать файл 📁"],
    ["✓ Fayl yuklandi", "✓ File uploaded", "✓ Файл загружен"],
    ["✕ Bekor qilish", "✕ Cancel", "✕ Отмена"],
    ["Google Docs hujjatingiz havolasini kiriting (hujjatda", "Enter the link to your Google Docs document (the document must be", "Введите ссылку на документ Google Docs (в документе должен быть"],
    ["ochiq bo'lishi kerak):", "enabled):", "включён доступ):"],
    ["📥 Import qilish", "📥 Import", "📥 Импортировать"],
    ["Tavsiya qilinadigan eng tez usul:", "The recommended fastest way:", "Рекомендуемый самый быстрый способ:"],
    ["Google Docs'da", "In Google Docs,", "В Google Docs"],
    ["Fayl → Yuklab olish → Microsoft Word (.docx)", "File → Download → Microsoft Word (.docx)", "Файл → Скачать → Microsoft Word (.docx)"],
    ["qilib, yuqoridagi", "and drop it into the", "и перетащите в раздел"],
    ["bo'limiga tashlasangiz, 1 soniyada butun matn tahrirlagichga tushadi!", "section above, and the whole text lands in the editor in 1 second!", "выше — и весь текст за 1 секунду окажется в редакторе!"],
    ["BOB NOMI / CHAPTER TITLE", "CHAPTER TITLE", "НАЗВАНИЕ ГЛАВЫ"],
    ["masalan, 1-bob. Dashtdan o'tish", "e.g. Chapter 1. Crossing the Steppe", "например, Глава 1. Переход через степь"],
    ["BOB MATNI / INITIAL CONTENT", "INITIAL CONTENT", "НАЧАЛЬНЫЙ ТЕКСТ"],
    ["(ixtiyoriy, keyinroq to'liq tahrirlashingiz mumkin)", "(optional, you can edit it fully later)", "(необязательно, позже можно полностью отредактировать)"],
    ["Bob matnini shu yerga yozing, fayl yuklang yoki Google Docs'dan import qiling...", "Write the chapter text here, upload a file or import from Google Docs...", "Напишите текст главы здесь, загрузите файл или импортируйте из Google Docs..."],
    ["📖 Bepul bob (Free Chapter)", "📖 Free chapter", "📖 Бесплатная глава"],
    ["⭐ Premium bob (Tangalar evaziga)", "⭐ Premium chapter (for coins)", "⭐ Премиум-глава (за монеты)"],
    ["Bob qo'shish →", "Add chapter →", "Добавить главу →"],
    ["Qo'shish va Tahrirlashga o'tish ↗", "Add and go to editing ↗", "Добавить и перейти к редактированию ↗"],
    ["Ushbu bobni o'chirmoqchimisiz?", "Do you want to delete this chapter?", "Вы хотите удалить эту главу?"],
    ["Bob muvaffaqiyatli o'chirildi.", "The chapter was deleted.", "Глава успешно удалена."],
    ["Bobni o'chirishda xatolik yuz berdi.", "An error occurred while deleting the chapter.", "При удалении главы произошла ошибка."],
    ["Hujjat o'quvchi modul topilmadi.", "The document reader module was not found.", "Модуль чтения документов не найден."],
    ["Fayl o'qilmoqda, iltimos kuting...", "Reading the file, please wait...", "Файл читается, пожалуйста, подождите..."],
    ["Faylni o'qishda xatolik yuz berdi. Iltimos boshqa formatda (masalan .docx yoki .txt) urinib ko'ring.", "An error occurred while reading the file. Please try another format (e.g. .docx or .txt).", "Ошибка при чтении файла. Попробуйте другой формат (например, .docx или .txt)."],
    ["Iltimos, Google Docs hujjatingiz havolasini kiriting.", "Please enter your Google Docs link.", "Введите ссылку на документ Google Docs."],
    ["DocImporter moduli mavjud emas.", "The DocImporter module is not available.", "Модуль DocImporter недоступен."],
    ["Google Docs hujjati tekshirilmoqda...", "Checking the Google Docs document...", "Проверяем документ Google Docs..."],
    ["✓ Google Docs hujjati muvaffaqiyatli import qilindi!", "✓ The Google Docs document was imported!", "✓ Документ Google Docs успешно импортирован!"],
    ["✓ Google Docs matni muvaffaqiyatli joylashtirildi!", "✓ The Google Docs text was pasted!", "✓ Текст из Google Docs успешно вставлен!"],
    ["Google Docs havolasini import qilishda xatolik yuz berdi.", "An error occurred while importing the Google Docs link.", "Ошибка при импорте ссылки Google Docs."],
    ["Iltimos, bob sarlavhasini (Chapter Title) kiriting.", "Please enter the chapter title.", "Введите название главы."],
    ["Bob qo'shishda xatolik yuz berdi.", "An error occurred while adding the chapter.", "При добавлении главы произошла ошибка."],
    ["✓ Yangi bob muvaffaqiyatli qo'shildi!", "✓ The new chapter was added!", "✓ Новая глава успешно добавлена!"],
    ["Akkauntingiz bloklangan.", "Your account has been blocked.", "Ваш аккаунт заблокирован."],
    ["Bu email allaqachon ro'yxatdan o'tgan.", "This email is already registered.", "Этот email уже зарегистрирован."],
    ["Eski parol noto'g'ri.", "The old password is incorrect.", "Старый пароль неверен."],
    ["Parol o'zgartirildi.", "Password changed.", "Пароль изменён."],
    ["Parol noto'g'ri.", "Incorrect password.", "Неверный пароль."],
    ["Parol yangilandi. Endi kirishingiz mumkin.", "Password updated. You can now sign in.", "Пароль обновлён. Теперь вы можете войти."],
    ["Havola yaroqsiz yoki muddati tugagan. Yangi havola so'rang.", "The link is invalid or has expired. Request a new one.", "Ссылка недействительна или устарела. Запросите новую."],
    ["Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasi yuborildi.", "If this email is registered, a password reset link has been sent.", "Если этот email зарегистрирован, ссылка для сброса пароля отправлена."],
    ["O'zingizni kuzata olmaysiz.", "You can't follow yourself.", "Нельзя подписаться на самого себя."],
    ["O'z she'ringizni baholay olmaysiz.", "You can't rate your own poem.", "Нельзя оценить собственное стихотворение."],
    ["Baho 1 dan 5 gacha bo'lishi kerak.", "The rating must be between 1 and 5.", "Оценка должна быть от 1 до 5."],
    ["Tanga yetarli emas.", "Not enough coins.", "Недостаточно монет."],
    ["Sessiya muddati tugadi. Iltimos, qaytadan kiring.", "Your session has expired. Please sign in again.", "Сессия истекла. Пожалуйста, войдите снова."],
    ["Xodim akkauntini bu yerdan o'chirib bo'lmaydi.", "A staff account cannot be deleted here.", "Аккаунт сотрудника нельзя удалить здесь."],
  ];

  /* ---------- Raqamli / o'zgaruvchan matnlar (regex) ---------- */
  const PATTERNS = [
    // Sahifalarga xos qoidalar (umumiy qoidalardan oldin tekshiriladi)
    [/^Jami (\d+) ta asar$/, { ru: "Всего работ: $1", en: "$1 works in total" }],
    [/^(\d+) ta asar topildi \(Jami: (\d+)\)$/, { ru: "Найдено работ: $1 (всего: $2)", en: "$1 works found (total: $2)" }],
    [/^(\d+) ta natija: \"(.*)\"$/, { ru: "Результатов: $1 — «$2»", en: "$1 results: \"$2\"" }],
    [/^(\d+) bob$/, { ru: "$1 глав", en: "$1 chapters" }],
    [/^(\d+) chapters · (\d+) reads · (\d+) likes · Status: (.+)$/, { uz: "$1 bob · $2 marta o'qilgan · $3 layk · Holati: $4", ru: "$1 глав · $2 прочтений · $3 лайков · Статус: $4" }],
    [/^(\d+) chapters · (\d+) reads$/, { uz: "$1 bob · $2 marta o'qilgan", ru: "$1 глав · $2 прочтений" }],
    [/^(\d+) so'z$/, { en: "$1 words", ru: '$1 слов' }],
    [/^-- coins$/, { uz: '-- tanga', ru: '-- монет' }],
    [/^\+(\d+) bonus$/, { uz: "+$1 bonus", ru: "+$1 бонус" }],
    [/^([\d,]+) so'm$/, { ru: "$1 сум", en: "$1 UZS" }],
    [/^— coins$/, { uz: "— tanga", ru: "— монет" }],
    [/^(\d+) of (\d+)$/, { uz: "$2 tadan $1-si", ru: "$1 из $2" }],
    [/^Server xatosi \((\d+)\)\.$/, { ru: "Ошибка сервера ($1).", en: "Server error ($1)." }],
    [/^Hush kelibsiz, (.+)! Bosh sahifaga yo'naltirilmoqda\.\.\.$/, { ru: "Добро пожаловать, $1! Перенаправляем на главную...", en: "Welcome, $1! Redirecting to the home page..." }],
    [/^Showing 1–(\d+) of ([\d,]+) fiction stories$/, { uz: "$2 ta hikoyadan 1–$1 tasi ko'rsatilmoqda", ru: 'Показано 1–$1 из $2 рассказов' }],
    [/^Showing 1–(\d+) of ([\d,]+) poems$/, { uz: "$2 ta she'rdan 1–$1 tasi ko'rsatilmoqda", ru: 'Показано 1–$1 из $2 стихотворений' }],
    [/^Click to expand full poem ↓ · ([\d.,]+K?) reads$/, { uz: "To'liq she'rni ochish uchun bosing ↓ · $1 marta o'qilgan", ru: 'Нажмите, чтобы развернуть ↓ · $1 прочтений' }],
    [/^Click to expand full poem ↓$/, { uz: "To'liq she'rni ochish uchun bosing ↓", ru: 'Нажмите, чтобы развернуть ↓' }],
    [/^(.*?)([\d.,]+K?) reads$/, { uz: "$1$2 marta o'qilgan", ru: '$1$2 прочтений' }],
    [/^CHAPTER (\d+) OF (\d+)$/, { uz: '$1-BOB, JAMI $2 TA', ru: 'ГЛАВА $1 ИЗ $2' }],
    [/^Unlock for (\d+) coins$/, { uz: '$1 tangaga ochish', ru: 'Открыть за $1 монет' }],
    [/^This chapter costs (\d+) coins\.$/, { uz: "Bu bob $1 tanga turadi.", ru: 'Эта глава стоит $1 монет.' }],
    [/^⭐ (\d+) coins$/, { uz: '⭐ $1 tanga', ru: '⭐ $1 монет' }],
    [/^(\d+) coins$/, { uz: '$1 tanga', ru: '$1 монет' }],
    [/^(\d+) chapters$/, { uz: '$1 bob', ru: '$1 глав' }],
    [/^(\d+) words$/, { uz: "$1 so'z", ru: '$1 слов' }],
    [/^(\d+) min read$/, { uz: "$1 daqiqalik o'qish", ru: '$1 мин чтения' }],
    // Blog satri: "Muallif · Sana · 2 min read"
    [/^(.+ · )(\d+) min read$/, { uz: "$1$2 daqiqalik o'qish", ru: '$1$2 мин чтения' }],
  ];

  /* ---------- Yadro ---------- */
  const DICT = new Map();
  // Turli apostroflar (ʻ ʼ ’ ‘ `) bitta ' ga keltiriladi — lug'at kaliti aniq mos tushishi uchun
  const norm = s => String(s).replace(/[ʻʼ’‘`´]/g, "'").replace(/\s+/g, ' ').trim();
  EN.forEach(([en, uz, ru]) => DICT.set(norm(en), { en, uz, ru }));
  UZ.forEach(([uz, en, ru]) => DICT.set(norm(uz), { uz, en, ru }));
  // BOSH HARFLI matnlar ("PUBLISHING GUIDE") lug'atdagi oddiy yozuvdan avtomatik topiladi
  const UPPER = new Map();
  DICT.forEach((entry, k) => { const u = k.toUpperCase(); if (u !== k && !DICT.has(u)) UPPER.set(u, entry); });

  function getLang() {
    let value = null;
    try { value = localStorage.getItem(KEY); } catch (e) { /* storage yopiq */ }
    if (LEGACY[value]) value = LEGACY[value];
    return LANGS.includes(value) ? value : DEFAULT_LANG;
  }

  let lang = getLang();

  function translate(text) {
    const key = norm(text);
    if (!key) return null;
    const hit = DICT.get(key);
    if (hit) return hit[lang] || null;
    if (key === key.toUpperCase() && key !== key.toLowerCase()) {
      const up = UPPER.get(key);
      if (up && up[lang]) return up[lang].toUpperCase();
    }
    if (key.endsWith(' — Penaura')) {
      const head = DICT.get(key.slice(0, -' — Penaura'.length));
      if (head && head[lang]) return head[lang] + ' — Penaura';
    }
    for (const [re, map] of PATTERNS) {
      if (map[lang] && re.test(key)) return key.replace(re, map[lang]);
    }
    return null;
  }

  const TEXT_ORIG = new WeakMap();   // matn tuguni -> asl matn
  const TEXT_WROTE = new WeakMap();  // matn tuguni -> biz yozgan oxirgi qiymat
  const ATTR_STATE = new WeakMap();  // element -> { attr: { orig, wrote } }
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);

  function processText(node) {
    const current = node.nodeValue;
    if (!current || !current.trim()) return;
    let orig = TEXT_ORIG.get(node);
    if (orig === undefined || current !== TEXT_WROTE.get(node)) {
      orig = current;                // yangi yoki ilova o'zi o'zgartirgan matn
      TEXT_ORIG.set(node, orig);
    }
    // data-i18n="Kalit" bo'lsa, matn o'rniga shu kalit tarjima qilinadi (so'z tartibi o'zgaradigan joylar uchun)
    const keyAttr = node.parentElement && node.parentElement.getAttribute('data-i18n');
    const translated = keyAttr ? (lang === 'en' ? null : translate(keyAttr)) : translate(orig);
    let out = orig;
    if (translated) {
      const lead = orig.match(/^\s*/)[0];
      const trail = orig.match(/\s*$/)[0];
      out = lead + translated + trail;
    }
    if (out !== current) node.nodeValue = out;
    TEXT_WROTE.set(node, out);
  }

  function processAttrs(el) {
    if (SKIP_TAGS.has(el.tagName) && el.tagName !== 'TEXTAREA') return;
    let state = ATTR_STATE.get(el);
    for (const attr of ATTRS) {
      if (!el.hasAttribute(attr)) continue;
      if (!state) { state = {}; ATTR_STATE.set(el, state); }
      const current = el.getAttribute(attr);
      let rec = state[attr];
      if (!rec || current !== rec.wrote) { rec = state[attr] = { orig: current, wrote: current }; }
      const translated = translate(rec.orig);
      const out = translated || rec.orig;
      if (out !== current) el.setAttribute(attr, out);
      rec.wrote = out;
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { processText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP_TAGS.has(root.tagName) || root.closest('[data-no-i18n]')) return;
    processAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE && (SKIP_TAGS.has(n.tagName) || n.hasAttribute('data-no-i18n'))) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === Node.TEXT_NODE) processText(n); else processAttrs(n);
    }
  }

  const observer = new MutationObserver(records => {
    observer.disconnect();
    try {
      for (const r of records) {
        if (r.type === 'childList') r.addedNodes.forEach(walk);
        else if (r.type === 'characterData') processText(r.target);
        else if (r.type === 'attributes') processAttrs(r.target);
      }
    } finally { observe(); }
  });

  function observe() {
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS,
    });
  }

  function applyAll() {
    observer.disconnect();
    try {
      document.documentElement.lang = lang;
      walk(document.documentElement);
    } finally { observe(); }
  }

  function setLang(code) {
    if (!LANGS.includes(code)) return;
    try { localStorage.setItem(KEY, code); } catch (e) { /* storage yopiq */ }
    lang = code;
    applyAll();
    document.dispatchEvent(new CustomEvent('penaura:langchange', { detail: { lang: code } }));
  }

  /* alert / confirm / prompt oynalari DOM'da emas, shuning uchun ularni alohida tarjima qilamiz */
  function translateMessage(message) {
    const text = String(message);
    const whole = translate(text);
    if (whole) return whole;
    return text.split('\n').map(line => translate(line) || line).join('\n');
  }
  ['alert', 'confirm', 'prompt'].forEach(name => {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function (message, ...rest) {
      return original.call(window, message == null ? message : translateMessage(message), ...rest);
    };
  });

  window.PenauraI18n = { getLang: () => lang, setLang, apply: applyAll, t: text => translate(text) || text };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyAll);
  else applyAll();
})();