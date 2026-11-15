from django.db import migrations, models


def mark_published_as_notified(apps, schema_editor):
    """Allaqachon nashr qilingan boblar uchun kuzatuvchilarga xabar yuborilmaydi (eski boblar \"yangi\" bo'lib qolmasin)."""
    Chapter = apps.get_model("catalog", "Chapter")
    Chapter.objects.filter(status="published").update(followers_notified=True)


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0007_book_is_featured'),
    ]

    operations = [
        migrations.AddField(
            model_name='chapter',
            name='followers_notified',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_published_as_notified, migrations.RunPython.noop),
    ]