package version

import (
	"fmt"
	"runtime"
)

// Version is the semver
type Version struct {
	value string
	name  string
}

// NewVersion creates a Version object
func NewVersion() *Version {
	return &Version{
		value: Value,
		name:  ProductName,
	}
}

// Name returns the alternative name of Version.
func (v *Version) Name() string {
	return v.name
}

// SemVer returns Version in semver format
func (v *Version) SemVer() string {
	return fmt.Sprintf("V%s", v.value)
}

// String converts Version to a string
func (v *Version) String() string {
	return fmt.Sprintf("%s %s\n%s", v.name, v.SemVer(), NewBuildInfo().String())
}

// Build is the info of building environment
type Build struct {
	GitHash   string `json:"gitHash"`
	GitRef    string `json:"gitRef"`
	GoVersion string `json:"goVersion"`
}

// NewBuildInfo creates a Build object
func NewBuildInfo() *Build {
	return &Build{
		GitHash:   GitHash,
		GitRef:    GitRef,
		GoVersion: runtime.Version(),
	}
}

// String converts Build to a string
func (v *Build) String() string {
	return fmt.Sprintf("Go Version: %s\nGit Ref: %s\nGit Hash: %s", v.GoVersion, v.GitRef, v.GitHash)
}
