from django.urls import path

from . import views

urlpatterns = [
    path("orders/", views.OrderCreateView.as_view()),
    path("orders/<int:pk>/", views.OrderDetailView.as_view()),
    path("orders/<int:pk>/mock-pay/", views.MockPayView.as_view()),
    # Click shu manzillarga so'rov yuboradi (bittasini ham, ikkalasini ham ko'rsatsa bo'ladi)
    path("click/", views.click_callback),
    path("click/prepare/", views.click_callback),
    path("click/complete/", views.click_callback),
]
