package version

import (
	"strings"
	"testing"
)

func TestVersionExposesInjectedBuildMetadata(t *testing.T) {
	oldValue, oldHash, oldRef, oldProductName := Value, GitHash, GitRef, ProductName
	t.Cleanup(func() {
		Value, GitHash, GitRef, ProductName = oldValue, oldHash, oldRef, oldProductName
	})

	Value = "1.2.3-rc.1"
	GitHash = "test-sha"
	GitRef = "v1.2.3-rc.1"
	ProductName = "Example Studio"

	output := NewVersion().String()
	for _, expected := range []string{
		"Example Studio V1.2.3-rc.1",
		"Git Ref: v1.2.3-rc.1",
		"Git Hash: test-sha",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("expected %q in version output:\n%s", expected, output)
		}
	}
}
