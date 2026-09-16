package ecode

import (
	"fmt"
	"net/http"
)

const (
	// ErrorNamespaceCode is fixed to preserve the existing Studio API error codes.
	ErrorNamespaceCode = 4
)

// Define you error code here
var (
	ErrBadRequest       = newErrCode(CCBadRequest, ErrorNamespaceCode, 0, "ErrBadRequest")           // 40004000
	ErrParam            = newErrCode(CCBadRequest, ErrorNamespaceCode, 1, "ErrParam")                // 40004001
	ErrUnauthorized     = newErrCode(CCUnauthorized, ErrorNamespaceCode, 0, "ErrUnauthorized")       // 40104000
	ErrSession          = newErrCode(CCUnauthorized, ErrorNamespaceCode, 1, "ErrSession")            // 40104001
	ErrNoClient         = newErrCode(CCUnauthorized, ErrorNamespaceCode, 2, "ErrNoClient")           // 40104002
	ErrForbidden        = newErrCode(CCForbidden, ErrorNamespaceCode, 0, "ErrForbidden")             // 40304000
	ErrNotFound         = newErrCode(CCNotFound, ErrorNamespaceCode, 0, "ErrNotFound")               // 40404000
	ErrRequestTooLarge  = newErrCode(CCRequestTooLarge, ErrorNamespaceCode, 0, "ErrRequestTooLarge") // 41304000
	ErrInternalServer   = newErrCode(CCInternalServer, ErrorNamespaceCode, 0, "ErrInternalServer")   // 50004000
	ErrInternalDatabase = newErrCode(CCInternalServer, ErrorNamespaceCode, 1, "ErrInternalDatabase") // 50004001
	ErrNotImplemented   = newErrCode(CCNotImplemented, ErrorNamespaceCode, 0, "ErrNotImplemented")   // 50104000
	ErrUnknown          = newErrCode(CCUnknown, ErrorNamespaceCode, 0, "ErrUnknown")                 // 90004000
)

var statusCodeErrorMapping = map[int]*ErrCode{
	http.StatusBadRequest:            ErrBadRequest,
	http.StatusUnauthorized:          ErrUnauthorized,
	http.StatusForbidden:             ErrForbidden,
	http.StatusNotFound:              ErrNotFound,
	http.StatusRequestEntityTooLarge: ErrRequestTooLarge,
	http.StatusInternalServerError:   ErrInternalServer,
	http.StatusNotImplemented:        ErrNotImplemented,
}

func GetErrCodeByHTTPStatus(httpStatus int) *ErrCode {
	if c, ok := statusCodeErrorMapping[httpStatus]; ok {
		return c
	}
	return ErrInternalServer
}

func WithBadRequest(err error, formatWithArgs ...interface{}) error {
	return WithCode(ErrBadRequest, err, formatWithArgs...)
}

func WithUnauthorized(err error, formatWithArgs ...interface{}) error {
	return WithCode(ErrUnauthorized, err, formatWithArgs...)
}

func WithSessionMessage(err error, formatWithArgs ...interface{}) error {
	return WithErrorMessage(ErrSession, err, formatWithArgs...)
}

func WithErrorMessage(c *ErrCode, err error, formatWithArgs ...interface{}) error {
	ErrWithMessage := newErrCode(c.GetCategoryCode(), c.GetPlatformCode(), c.GetSpecificCode(), fmt.Sprintf("%s::%s", c.GetMessage(), err.Error()))
	return WithCode(ErrWithMessage, err, formatWithArgs...)
}

func WithForbidden(err error, formatWithArgs ...interface{}) error {
	return WithCode(ErrForbidden, err, formatWithArgs...)
}

func WithNotFound(err error, formatWithArgs ...interface{}) error {
	return WithCode(ErrNotFound, err, formatWithArgs...)
}

func WithInternalServer(err error, formatWithArgs ...interface{}) error {
	return WithCode(ErrInternalServer, err, formatWithArgs...)
}

func WithNotImplemented(err error, formatWithArgs ...interface{}) error {
	return WithCode(ErrNotImplemented, err, formatWithArgs...)
}

func WithUnknown(err error, formatWithArgs ...interface{}) error {
	return WithCode(ErrUnknown, err, formatWithArgs...)
}

func IsBadRequest(err error) bool {
	return IsCodeError(err, ErrBadRequest)
}

func IsUnauthorized(err error) bool {
	return IsCodeError(err, ErrUnauthorized)
}

func IsForbidden(err error) bool {
	return IsCodeError(err, ErrForbidden)
}

func IsNotFound(err error) bool {
	return IsCodeError(err, ErrNotFound)
}

func IsInternalServer(err error) bool {
	return IsCodeError(err, ErrInternalServer)
}

func IsNotImplemented(err error) bool {
	return IsCodeError(err, ErrNotImplemented)
}

func IsUnknown(err error) bool {
	return IsCodeError(err, ErrUnknown)
}
