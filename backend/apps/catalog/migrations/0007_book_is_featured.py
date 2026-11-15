# Tanlangan asarlar (Featured Works) uchun belgi

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0006_book_bookmark'),
    ]

    operations = [
        migrations.AddField(
            model_name='book',
            name='is_featured',
            field=models.BooleanField(default=False, verbose_name='Tanlangan asar'),
        ),
    ]
