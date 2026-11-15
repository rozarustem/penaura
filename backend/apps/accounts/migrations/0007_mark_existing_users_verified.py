from django.db import migrations


def mark_existing_verified(apps, schema_editor):
    """Tasdiqlash tizimi qo'shilishidan oldin ro'yxatdan o'tgan hamma foydalanuvchi tasdiqlangan hisoblanadi."""
    User = apps.get_model("accounts", "User")
    User.objects.update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_email_verification"),
    ]

    operations = [
        migrations.RunPython(mark_existing_verified, migrations.RunPython.noop),
    ]