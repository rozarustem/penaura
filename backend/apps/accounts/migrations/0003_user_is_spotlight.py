# Oy muallifi (Author Spotlight) uchun belgi

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_auditlog_wallet_wallettransaction_follow_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_spotlight',
            field=models.BooleanField(default=False, verbose_name='Oy muallifi'),
        ),
    ]
