import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0004_wallettransaction_purchase'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PaymentOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('click', 'Click'), ('payme', 'Payme'), ('mock', 'Test (faqat DEBUG)')], max_length=16)),
                ('package', models.CharField(max_length=16)),
                ('coins', models.PositiveIntegerField()),
                ('bonus_coins', models.PositiveIntegerField(default=0)),
                ('amount_uzs', models.PositiveIntegerField()),
                ('status', models.CharField(choices=[('created', 'Created'), ('prepared', 'Prepared'), ('paid', 'Paid'), ('cancelled', 'Cancelled')], default='created', max_length=16)),
                ('external_id', models.CharField(blank=True, max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='payment_orders', to=settings.AUTH_USER_MODEL)),
                ('wallet_transaction', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='payment_order', to='accounts.wallettransaction')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddConstraint(
            model_name='paymentorder',
            constraint=models.UniqueConstraint(condition=models.Q(('external_id', ''), _negated=True), fields=('provider', 'external_id'), name='unique_provider_external_id'),
        ),
    ]
