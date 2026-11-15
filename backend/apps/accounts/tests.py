from django.test import TestCase
from rest_framework.test import APIClient

from .models import AuditLog, User, Wallet


class RegistrationTests(TestCase):
    def test_registration_creates_wallet_without_fake_coin_credit(self):
        response = self.client.post("/api/auth/register/", {
            "full_name": "Test User",
            "email": "test@example.com",
            "phone": "",
            "password": "SafePassword123!",
            "role": "reader",
        })
        self.assertEqual(response.status_code, 201)
        wallet = Wallet.objects.get(user__email="test@example.com")
        self.assertEqual(wallet.balance, 0)
        self.assertNotIn("password", response.data)

    def test_public_registration_cannot_assign_staff_role(self):
        response = self.client.post("/api/auth/register/", {
            "full_name": "Test User",
            "email": "test@example.com",
            "phone": "",
            "password": "SafePassword123!",
            "role": "direktor",
        })
        self.assertEqual(response.status_code, 400)


class AdminUserApiTests(TestCase):
    def setUp(self):
        mk = User.objects.create_user
        self.director = mk(email="d@example.com", password="SafePassword123!",
                           full_name="Director", role=User.Role.DIREKTOR)
        self.moderator = mk(email="m@example.com", password="SafePassword123!",
                            full_name="Moderator", role=User.Role.MODERATOR)
        self.finance = mk(email="f@example.com", password="SafePassword123!",
                          full_name="Finance", role=User.Role.MOLIYACHI)
        self.reader = mk(email="r@example.com", password="SafePassword123!",
                         full_name="Reader One", role=User.Role.READER, phone="+998901112233")
        self.writer = mk(email="w@example.com", password="SafePassword123!",
                         full_name="Writer One", role=User.Role.WRITER)
        Wallet.objects.create(user=self.reader, balance=7)
        self.api = APIClient()

    def login(self, user):
        self.api.force_authenticate(user)

    def test_list_has_coins_stats_and_search(self):
        self.login(self.moderator)
        data = self.api.get("/api/auth/admin/users/").data
        self.assertEqual(data["count"], 5)
        self.assertEqual(data["stats"]["writers"], 1)
        self.assertEqual(data["stats"]["readers"], 1)
        self.assertEqual(data["stats"]["blocked"], 0)
        found = self.api.get("/api/auth/admin/users/?search=998901112233").data["results"]
        self.assertEqual([u["email"] for u in found], ["r@example.com"])
        self.assertEqual(found[0]["coins"], 7)
        self.assertNotIn("password", found[0])

    def test_finance_role_cannot_list_or_block(self):
        self.login(self.finance)
        self.assertEqual(self.api.get("/api/auth/admin/users/").status_code, 403)
        self.assertEqual(self.api.post(f"/api/auth/admin/users/{self.reader.pk}/",
                                       {"is_blocked": True}, format="json").status_code, 403)

    def test_block_unblock_is_audited_and_blocks_login(self):
        self.login(self.director)
        url = f"/api/auth/admin/users/{self.reader.pk}/"
        self.assertEqual(self.api.post(url, {"is_blocked": True}, format="json").status_code, 200)
        self.reader.refresh_from_db()
        self.assertTrue(self.reader.is_blocked)
        self.assertTrue(AuditLog.objects.filter(action="user_blocked",
                                                target_id=str(self.reader.pk)).exists())
        self.api.post(url, {"is_blocked": False}, format="json")
        self.assertTrue(AuditLog.objects.filter(action="user_unblocked").exists())

    def test_staff_cannot_be_blocked(self):
        self.login(self.director)
        r = self.api.post(f"/api/auth/admin/users/{self.moderator.pk}/",
                          {"is_blocked": True}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_detail_audit_only_for_director(self):
        AuditLog.objects.create(actor=self.director, action="user_blocked",
                                target_type="user", target_id=str(self.reader.pk))
        url = f"/api/auth/admin/users/{self.reader.pk}/"
        self.login(self.director)
        self.assertEqual(len(self.api.get(url).data["audit"]), 1)
        self.login(self.moderator)
        self.assertEqual(self.api.get(url).data["audit"], [])

    def test_audit_list_director_only(self):
        self.login(self.moderator)
        self.assertEqual(self.api.get("/api/auth/admin/audit/").status_code, 403)
        self.login(self.director)
        self.assertEqual(self.api.get("/api/auth/admin/audit/").status_code, 200)

    def test_director_changes_role_and_it_is_audited(self):
        self.login(self.director)
        url = f"/api/auth/admin/users/{self.writer.pk}/role/"
        r = self.api.post(url, {"role": "moderator"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["role"], "moderator")
        self.writer.refresh_from_db()
        self.assertEqual(self.writer.role, User.Role.MODERATOR)
        log = AuditLog.objects.get(action="user_role_changed", target_id=str(self.writer.pk))
        self.assertEqual(log.actor, self.director)
        self.assertEqual(log.details["from_role"], "writer")
        self.assertEqual(log.details["to_role"], "moderator")

    def test_only_director_can_change_roles(self):
        url = f"/api/auth/admin/users/{self.reader.pk}/role/"
        for user in (self.moderator, self.finance):
            self.login(user)
            self.assertEqual(self.api.post(url, {"role": "writer"}, format="json").status_code, 403)
        self.reader.refresh_from_db()
        self.assertEqual(self.reader.role, User.Role.READER)

    def test_director_cannot_change_own_role(self):
        self.login(self.director)
        r = self.api.post(f"/api/auth/admin/users/{self.director.pk}/role/",
                          {"role": "reader"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.director.refresh_from_db()
        self.assertEqual(self.director.role, User.Role.DIREKTOR)

    def test_role_change_rejects_invalid_or_same_role(self):
        self.login(self.director)
        url = f"/api/auth/admin/users/{self.reader.pk}/role/"
        self.assertEqual(self.api.post(url, {"role": "superadmin"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"role": "reader"}, format="json").status_code, 400)
        self.assertFalse(AuditLog.objects.filter(action="user_role_changed").exists())

    def test_blocked_user_cannot_become_staff(self):
        self.reader.is_blocked = True
        self.reader.save(update_fields=["is_blocked"])
        self.login(self.director)
        url = f"/api/auth/admin/users/{self.reader.pk}/role/"
        self.assertEqual(self.api.post(url, {"role": "tahrirchi"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"role": "writer"}, format="json").status_code, 200)