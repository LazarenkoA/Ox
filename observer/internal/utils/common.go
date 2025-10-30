package utils

import (
	"github.com/pkg/errors"
	"log"
)

func OpenBrowser(url string) {
	err := cmd(url).Start()
	if err != nil {
		log.Println("ERROR:", errors.Wrap(err, "open browser"))
	}
}
