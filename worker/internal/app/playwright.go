package app

import (
	"context"
	"embed"
	"fmt"
	"github.com/pkg/errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

//go:embed resource/*
var staticFS embed.FS

func (w *Worker) runTest(ctx context.Context, jobID, playwrightDir string) error {
	w.logger.DebugContext(ctx, "exec run playwright test", "job_id", jobID)

	if strings.TrimSpace(w.script) == "" {
		return errors.New("script not filled ")
	}

	outDir := filepath.Join(playwrightDir, "reports", jobID)

	f, err := os.CreateTemp(filepath.Join(playwrightDir, "tests"), "*.spec.js")
	if err != nil {
		return errors.Wrap(err, "create temp error")
	}
	_, _ = f.WriteString(w.script)
	_ = f.Close()
	defer os.Remove(f.Name())

	_, file := filepath.Split(f.Name())
	cmd := exec.CommandContext(ctx, "npx", "playwright", "test", "tests/"+file, "--project", "chromium", "--reporter", "html")
	cmd.Dir = playwrightDir
	cmd.Env = append(os.Environ(),
		"PLAYWRIGHT_HTML_OPEN=never", // что б не открывался отчет в браузере
		"PLAYWRIGHT_HTML_OUTPUT_DIR="+outDir,
		"PLAYWRIGHT_VIDEO_MODE=retain-on-failure", // сохранит видео только для fallen тестов
	)

	_, err = w.cmdRun(ctx, cmd)
	if err == nil {
		_ = os.RemoveAll(outDir) // если не было ошибки киляем каталог
	}
	return err
}

func (w *Worker) checkInstall(ctx context.Context) (error, bool) {
	cmd := exec.CommandContext(ctx, "npx", "playwright", "test", "--version")

	out, err := w.cmdRun(ctx, cmd)
	if err != nil {
		return err, false
	}

	var re = regexp.MustCompile(`(?m)Version[\s]+[\d\.]+`)
	return nil, re.Match(out)
}

func (w *Worker) install(ctx context.Context) error {
	w.logger.InfoContext(ctx, "exec install playwright")

	cmd := exec.CommandContext(ctx, "npx", "playwright", "install")

	_, err := w.cmdRun(ctx, cmd)
	if err != nil {
		return err
	}

	return nil
}

func (w *Worker) create(ctx context.Context, rootDir string) error {
	w.logger.InfoContext(ctx, "exec create-playwright")

	if err := os.Mkdir(rootDir, os.ModeDir); err != nil {
		return err
	}

	cmd := exec.CommandContext(ctx, "npx", "create-playwright@latest", "--quiet", "--lang", "js", "--install-deps", "--gha")
	cmd.Dir = rootDir

	_, err := w.cmdRun(ctx, cmd)
	if err != nil {
		return err
	}

	// Заменяем playwright.config.js на свой
	if err := replacePlaywrightConfig(rootDir); err != nil {
		return fmt.Errorf("failed to replace config: %w", err)
	}

	return nil
}

func (w *Worker) cmdRun(ctx context.Context, cmd *exec.Cmd) ([]byte, error) {
	w.stopProcess(ctx, cmd)

	//stdout, err := cmd.StdoutPipe()
	//if err != nil {
	//	return errors.Wrap(err, "stdout pipe error")
	//}
	//
	//if err := cmd.Start(); err != nil {
	//	return errors.Wrap(err, "command start error")
	//}
	//
	//go func() {
	//	scanner := bufio.NewScanner(stdout)
	//	for scanner.Scan() {
	//		fmt.Println(scanner.Text())
	//	}
	//}()
	//
	//if err := cmd.Wait(); err != nil {
	//	return errors.Wrap(err, "the test failed with an error")
	//}

	out, err := cmd.CombinedOutput()
	if err != nil {
		w.logger.ErrorContext(ctx, "run process error", "playwright error", string(out))
		return out, errors.Wrap(err, "the test failed with an error")
	}

	return out, nil
}

func replacePlaywrightConfig(rootDir string) error {
	data, err := staticFS.ReadFile("resource/playwright.config.js")
	if err != nil {
		return err
	}

	targetPath := filepath.Join(rootDir, "playwright.config.js")
	return os.WriteFile(targetPath, data, 0o644)
}

// npx create-playwright@latest --quiet --lang=js --install-deps --gha
// npx playwright install
// npx playwright uninstall --all
// npx playwright --version
// npx playwright codegen http://localhost/bsp
// npx playwright test ./tests/bsp.spec.js --project=chromium --ui
