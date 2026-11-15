from django.urls import path

from . import views

urlpatterns = [
    path("editorial/works/", views.EditorialWorkListView.as_view()),
    path("editorial/showcase/", views.EditorialShowcaseView.as_view()),
    path("editorial/books/<int:pk>/featured/", views.EditorialFeatureBookView.as_view()),
    path("editorial/writers/<int:pk>/spotlight/", views.EditorialSpotlightView.as_view()),
    path("editorial/books/<int:pk>/action/", views.EditorialBookActionView.as_view()),
    path("editorial/chapters/<int:pk>/action/", views.EditorialChapterActionView.as_view()),
    path("editorial/poems/<int:pk>/action/", views.EditorialPoemActionView.as_view()),
    path("saved/", views.SavedView.as_view()),
    path("reading-progress/", views.ReadingProgressView.as_view()),
    path("writers/<int:user_id>/follow/", views.FollowView.as_view()),
    path("following/", views.FollowView.as_view()),
    path("poems/mine/", views.MyPoemsView.as_view()),
    path("poems/activity/", views.PoemActivityView.as_view()),
    path("poems/", views.PoemListCreateView.as_view()),
    path("poems/<str:slug>/rating/", views.PoemRatingView.as_view()),
    path("poems/<str:slug>/bookmark/", views.PoemBookmarkView.as_view()),
    path("poems/<str:slug>/", views.PoemDetailView.as_view()),
    path("articles/", views.ArticleListCreateView.as_view()),
    path("articles/<str:slug>/", views.ArticleDetailView.as_view()),
    path("books/", views.BookListCreateView.as_view()),
    path("books/mine/", views.MyBooksView.as_view()),
    path("books/<str:slug>/chapters/", views.ChapterCreateView.as_view()),
    path("books/<str:slug>/chapters/<int:pk>/unlock/", views.ChapterUnlockView.as_view()),
    path("books/<str:slug>/chapters/<int:pk>/", views.ChapterDetailView.as_view()),
    path("books/<str:slug>/like/", views.BookLikeView.as_view()),
    path("books/<str:slug>/bookmark/", views.BookBookmarkView.as_view()),
    path("books/<str:slug>/", views.BookDetailView.as_view()),
]