package http

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

type loggingResponseWriter struct {
	http.ResponseWriter
	status int
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(logger *slog.Logger) func(next http.Handler) http.Handler {
	logger = logger.With("name", "http middleware")

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.String() == "/api/v1/ws" { // исключение для ws
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			logger.DebugContext(r.Context(), fmt.Sprintf("HTTP request started (method: %s, url: %s)", r.Method, r.URL.String()))

			lw := &loggingResponseWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(lw, r)

			duration := time.Since(start)

			if lw.status >= 400 {
				logger.ErrorContext(r.Context(),
					fmt.Sprintf("HTTP request failed (method: %s, url: %s)", r.Method, r.URL.String()),
					"status", lw.status,
					"duration", duration.String(),
				)
			} else {
				logger.DebugContext(r.Context(),
					fmt.Sprintf("HTTP request completed (method: %s, url: %s)", r.Method, r.URL.String()),
					"status", lw.status,
					"duration", duration.String(),
				)
			}
		})
	}
}

func (lw *loggingResponseWriter) WriteHeader(statusCode int) {
	lw.status = statusCode
	lw.ResponseWriter.WriteHeader(statusCode)
}

func sendWorkersStatus(workers IObserver) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)

			// после первого подключения ws отправляем статус по workers
			for _, worker := range workers.Workers() {
				worker.ChangeState(worker.Status)
			}
		})
	}
}
