package utils

import (
	"net/http"
)

func DisabledCookie(name string, httpsEnable bool) *http.Cookie {
	cookie := &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	}
	if httpsEnable {
		cookie.Secure = true
		cookie.SameSite = http.SameSiteNoneMode
	}
	return cookie
}
