package utils

import "os/exec"

func cmd(url string) *exec.Cmd {
	return exec.Command("xdg-open", url)
}
