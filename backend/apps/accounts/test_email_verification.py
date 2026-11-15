from datetime import timedelta

from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import email_verification as ev
from .models import EmailVerificationCode, User

REGISTER = "/api/auth/register/"
LOGIN = "/api/auth/login/"
VERIFY = "/api/auth/verify-email/"
RESEND = "/api/auth/resend-verification/"
PASSWORD = "SafePassword123!"


def last_code():
    """Oxirgi yuborilgan xatdan 6 xonali kodni oladi."""
    body = mail.outbox[-1].body
    return next(part for part in body.replace("\n", " ").split() if part.isdigit() and len(part) == 6)


class EmailVerificationFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.email = "new@example.com"

    def _register(self, role="reader"):
        return self.client.post(REGISTER, {"full_name": "New User", "email": self.email,
                                           "password": PASSWORD, "role": role}, format="json")

    def test_registration_creates_unverified_user_and_sends_code(self):
        r = self._register()
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.data["email_verified"])
        self.assertFalse(User.objects.get(email=self.email).email_verified)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.email])
        self.assertEqual(len(last_code()), 6)

    def test_code_is_stored_hashed_not_plain(self):
        self._register()
        record = EmailVerificationCode.objects.get(user__email=self.email)
        self.assertNotIn(last_code(), record.code_hash)

    def test_unverified_user_cannot_login(self):
        self._register()
        r = self.client.post(LOGIN, {"email": self.email, "password": PASSWORD}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["code"], "email_not_verified")

    def test_wrong_password_does_not_reveal_verification_state(self):
        self._register()
        r = self.client.post(LOGIN, {"email": self.email, "password": "WrongPassword1!"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_correct_code_verifies_and_allows_login(self):
        self._register()
        r = self.client.post(VERIFY, {"email": self.email, "code": last_code()}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(User.objects.get(email=self.email).email_verified)
        self.assertFalse(EmailVerificationCode.objects.filter(user__email=self.email).exists())
        login = self.client.post(LOGIN, {"email": self.email, "password": PASSWORD}, format="json")
        self.assertEqual(login.status_code, 200)
        self.assertIn("access", login.data)

    def test_writer_must_verify_too(self):
        self._register(role="writer")
        r = self.client.post(LOGIN, {"email": self.email, "password": PASSWORD}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_wrong_code_rejected(self):
        self._register()
        wrong = "000000" if last_code() != "000000" else "111111"
        r = self.client.post(VERIFY, {"email": self.email, "code": wrong}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.get(email=self.email).email_verified)

    def test_malformed_code_rejected(self):
        self._register()
        for bad in ("12345", "abcdef", "1234567", ""):
            r = self.client.post(VERIFY, {"email": self.email, "code": bad}, format="json")
            self.assertEqual(r.status_code, 400, bad)

    def test_unknown_email_gets_same_error_as_wrong_code(self):
        r = self.client.post(VERIFY, {"email": "nobody@example.com", "code": "123456"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["detail"], "Kod noto'g'ri.")

    def test_code_expires_after_ttl(self):
        self._register()
        EmailVerificationCode.objects.update(sent_at=timezone.now() - ev.CODE_TTL - timedelta(seconds=1))
        r = self.client.post(VERIFY, {"email": self.email, "code": last_code()}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("muddati", r.data["detail"])
        self.assertFalse(User.objects.get(email=self.email).email_verified)

    def test_too_many_wrong_attempts_lock_the_code_even_for_correct_one(self):
        self._register()
        good = last_code()
        wrong = "000000" if good != "000000" else "111111"
        for _ in range(ev.MAX_ATTEMPTS):
            self.client.post(VERIFY, {"email": self.email, "code": wrong}, format="json")
        r = self.client.post(VERIFY, {"email": self.email, "code": good}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.get(email=self.email).email_verified)

    def test_resend_respects_cooldown(self):
        self._register()
        self.client.post(RESEND, {"email": self.email}, format="json")
        self.assertEqual(len(mail.outbox), 1)  # 60 soniya o'tmagan: yangi xat yo'q

    def test_resend_after_cooldown_sends_new_code_and_old_one_stops_working(self):
        self._register()
        old = last_code()
        EmailVerificationCode.objects.update(sent_at=timezone.now() - ev.RESEND_COOLDOWN - timedelta(seconds=1))
        r = self.client.post(RESEND, {"email": self.email}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        new = last_code()
        if new != old:
            r = self.client.post(VERIFY, {"email": self.email, "code": old}, format="json")
            self.assertEqual(r.status_code, 400)
        r = self.client.post(VERIFY, {"email": self.email, "code": new}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_resend_response_is_identical_for_unknown_email(self):
        known = self.client.post(RESEND, {"email": self.email}, format="json")
        self._register()
        unknown = self.client.post(RESEND, {"email": "ghost@example.com"}, format="json")
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.data, unknown.data)

    def test_no_code_sent_to_already_verified_user(self):
        User.objects.create_user(email=self.email, password=PASSWORD, full_name="V",
                                 role="reader", email_verified=True)
        self.client.post(RESEND, {"email": self.email}, format="json")
        self.assertEqual(len(mail.outbox), 0)

    def test_registration_still_succeeds_when_email_sending_fails(self):
        from unittest import mock
        with mock.patch("apps.accounts.email_verification.send_mail", side_effect=OSError("smtp down")):
            r = self._register()
        self.assertEqual(r.status_code, 201)
        self.assertFalse(User.objects.get(email=self.email).email_verified)

    def test_blocked_user_cannot_verify(self):
        self._register()
        User.objects.filter(email=self.email).update(is_blocked=True)
        r = self.client.post(VERIFY, {"email": self.email, "code": last_code()}, format="json")
        self.assertEqual(r.status_code, 400)


class StaffAndLegacyUsersTests(TestCase):
    def test_staff_login_not_blocked_by_verification(self):
        User.objects.create_user(email="dir@example.com", password=PASSWORD, full_name="D",
                                 role=User.Role.DIREKTOR, is_staff=True)
        r = APIClient().post("/api/auth/admin-login/", {"email": "dir@example.com", "password": PASSWORD},
                             format="json")
        self.assertEqual(r.status_code, 200)

    def test_createsuperuser_is_verified(self):
        admin = User.objects.create_superuser(email="root@example.com", password=PASSWORD, full_name="R")
        self.assertTrue(admin.email_verified)