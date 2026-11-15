from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class ActiveUserJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result and result[0].is_blocked:
            raise AuthenticationFailed("Akkauntingiz bloklangan.")
        return result
