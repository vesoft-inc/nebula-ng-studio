package main

import (
	"fmt"
	"os"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/studio"
)

func main() {
	if err := studio.Run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
