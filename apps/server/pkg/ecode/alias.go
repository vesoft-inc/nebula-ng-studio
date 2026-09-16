package ecode

import (
	"net/http"

	"github.com/vesoft-inc/go-pkg/errorx"
)

const (
	// CodeCategory
	CCBadRequest      = errorx.CCBadRequest              // 400
	CCUnauthorized    = errorx.CCUnauthorized            // 401
	CCForbidden       = errorx.CCForbidden               // 403
	CCNotFound        = errorx.CCNotFound                // 404
	CCRequestTooLarge = http.StatusRequestEntityTooLarge // 413
	CCInternalServer  = errorx.CCInternalServer          // 500
	CCNotImplemented  = errorx.CCNotImplemented          // 501
	CCUnknown         = errorx.CCUnknown                 // 900
)

var (
	// WithCode returns an error wrapped with codeError.
	// c is the code. err is the real err. formatWithArgs is format string with args.
	// For example:
	//  WithCode(ErrBadRequest, nil)
	//  WithCode(ErrBadRequest, err)
	//  WithCode(ErrBadRequest, err, "message")
	//  WithCode(ErrBadRequest, err, "message %s", "id")
	WithCode         = errorx.WithCode
	AsCodeError      = errorx.AsCodeError
	IsCodeError      = errorx.IsCodeError
	SeparateCode     = errorx.SeparateCode
	TakeCodePriority = errorx.TakeCodePriority

	// newErrCode is create an new *ErrCode, it's only used for global initialization.
	// Do not export so that it cannot be used outside of this package.
	newErrCode = errorx.NewErrCode
)

type (
	// ErrCode is the error code for app
	// 0 indicates success, others indicate failure.
	// It combines an error category, the Studio error namespace (named platform code by errorx),
	// and a specific code via CodeCombiner.
	// The default CodeCombiner's rules are as follows:
	// - The first three digits represent the category code, analogous to the http status code.
	// - The next two digits indicate the error namespace.
	// - The last three digits indicate the specific code.
	//   For example:
	//     4041001:
	// 	     404 is the error category code
	// 	      10 is the error namespace
	// 	     001 is the error specific code
	ErrCode   = errorx.ErrCode
	CodeError = errorx.CodeError
)
