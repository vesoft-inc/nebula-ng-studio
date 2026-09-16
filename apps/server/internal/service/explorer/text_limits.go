package explorer

import "fmt"

const mediumTextMaxBytes = 1<<24 - 1

func validateMediumText(field, value string) error {
	if len(value) > mediumTextMaxBytes {
		return fmt.Errorf("%s exceeds MEDIUMTEXT limit of %d UTF-8 bytes", field, mediumTextMaxBytes)
	}
	return nil
}
