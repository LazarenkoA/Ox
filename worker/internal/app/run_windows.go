package app

import (
	"context"
	"golang.org/x/sys/windows"
	"os/exec"
	"syscall"
)

// в windows отмена контекста не сразу останавливает процесс, поэтому написана такая функция
func (w *Worker) stopProcess(ctx context.Context, cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}

	go func() {
		<-ctx.Done()
		w.logger.WarnContext(ctx, "context canceled -> terminating process group")

		// Отправляем Ctrl-Break всей группе процессов
		_ = windows.GenerateConsoleCtrlEvent(syscall.CTRL_BREAK_EVENT, uint32(cmd.Process.Pid))
	}()
}
