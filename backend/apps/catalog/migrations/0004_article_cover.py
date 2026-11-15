from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0003_poem_edited"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="cover",
            field=models.ImageField(blank=True, upload_to="articles/"),
        ),
    ]