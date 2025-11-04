package utils

import (
	"fmt"
	"gopkg.in/natefinch/lumberjack.v2"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

var (
	logger *slog.Logger
)

func init() {
	logDir, _ := os.Getwd()
	rotator := &lumberjack.Logger{
		Filename:   filepath.Join(logDir, fmt.Sprintf("%s.log", time.Now().Format("2006-01-02 15-04-05"))), // путь к файлу
		MaxSize:    10,                                                                                     // мегабайты до ротации
		MaxBackups: 5,                                                                                      // сколько файлов хранить
		MaxAge:     30,                                                                                     // дней до удаления старых
		Compress:   true,                                                                                   // gzip старые логи
	}

	logger = slog.New(slog.NewJSONHandler(rotator, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
}

func Logger() *slog.Logger {
	return logger
}
