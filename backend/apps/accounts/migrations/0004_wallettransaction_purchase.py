from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_user_is_spotlight'),
    ]

    operations = [
        migrations.AlterField(
            model_name='wallettransaction',
            name='kind',
            field=models.CharField(choices=[('adjustment', 'Manual adjustment'), ('chapter_unlock', 'Chapter unlock'), ('purchase', 'Coin purchase')], max_length=30),
        ),
    ]