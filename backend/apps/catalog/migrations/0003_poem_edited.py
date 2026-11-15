from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0002_article_book_editor_lock_at_book_editor_lock_user_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="poem",
            name="edited",
            field=models.BooleanField(default=False),
        ),
    ]