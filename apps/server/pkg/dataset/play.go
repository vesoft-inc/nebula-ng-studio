package dataset

import (
	"bufio"
	"embed"
	"strings"

	"github.com/vesoft-inc/nebula-go/v5/pkg/types"
)

//go:embed movie.ngql
var DataFs embed.FS

func ExecuteFileDataImport(c types.Client, scanner *bufio.Scanner) error {
	var stmt string
	var multiLine bool
	var execute bool
	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if line == `"""` {
			if multiLine {
				multiLine = false
				execute = true
			} else {
				multiLine = true
			}
		} else {
			if multiLine {
				stmt += line + "\n"
			} else {
				stmt = line
				execute = true
			}
		}
		if execute {
			execute = false
			if _, err := c.Execute(stmt); err != nil {
				return err
			}
		}
	}
	return nil
}
