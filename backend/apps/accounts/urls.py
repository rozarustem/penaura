from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import admin_reports, earnings, notifications, views

urlpatterns = [
    path("register/", views.RegisterView.as_view()),
    path("admin/coin-sales/", admin_reports.AdminCoinSalesView.as_view()),
    path("admin/reports/", admin_reports.AdminReportsView.as_view()),
    path("admin/system-settings/", admin_reports.AdminSystemSettingsView.as_view()),
    path("verify-email/", views.VerifyEmailView.as_view()),
    path("resend-verification/", views.ResendVerificationView.as_view()),
    path("login/", views.LoginView.as_view()),
    path("admin-login/", views.AdminLoginView.as_view()),
    path("refresh/", TokenRefreshView.as_view()),
    path("me/", views.MeView.as_view()),
    path("spotlight/", views.SpotlightWriterView.as_view()),
    path("writers/<int:pk>/", views.PublicWriterView.as_view()),
    path("change-password/", views.ChangePasswordView.as_view()),
    path("delete-account/", views.DeleteAccountView.as_view()),
    path("password-reset/", views.PasswordResetRequestView.as_view()),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view()),
    path("wallet/", views.WalletView.as_view()),
    path("notifications/", notifications.NotificationListView.as_view()),
    path("notifications/read/", notifications.NotificationReadView.as_view()),
    path("admin/users/", views.AdminUserListView.as_view()),
    path("admin/users/<int:pk>/", views.AdminUserDetailView.as_view()),
    path("admin/users/<int:pk>/role/", views.AdminUserRoleView.as_view()),
    path("admin/wallet/credit/", views.WalletAdjustmentView.as_view()),
    path("admin/audit/", views.AuditLogListView.as_view()),
    path("earnings/", earnings.WriterEarningsView.as_view()),
    path("earnings/withdraw/", earnings.WithdrawalCreateView.as_view()),
    path("admin/finance/", earnings.AdminFinanceView.as_view()),
    path("admin/withdrawals/", earnings.AdminWithdrawalListView.as_view()),
    path("admin/withdrawals/<int:pk>/", earnings.AdminWithdrawalActionView.as_view()),
]