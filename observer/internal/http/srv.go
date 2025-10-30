package http

import (
	"context"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"io/fs"
	"load_testing/observer"
	"load_testing/observer/internal/config"
	"log"
	"log/slog"
	"net/http"
	"time"
)

type HttpSrv struct {
	port        int
	workersConf []config.WorkerConfig
	logger      *slog.Logger
	httpServ    *http.Server
}

func NewHTTP(port int, workers []config.WorkerConfig) (*HttpSrv, error) {
	mux := mux.NewRouter()

	resp := &HttpSrv{
		port:        port,
		workersConf: workers,
		logger:      slog.Default(),
		httpServ: &http.Server{
			Addr:              fmt.Sprintf(":%d", port),
			Handler:           mux,
			ReadHeaderTimeout: 2 * time.Second,
		},
	}

	return resp, resp.initRouts(mux)
}

func (h *HttpSrv) initRouts(mux *mux.Router) error {
	staticFS, err := fs.Sub(observer.StaticFS, "static")
	if err != nil {
		return err
	}

	mux.Use(loggingMiddleware(h.logger))
	mux.Use(enableCORS)

	// Отдаём статику (CSS/JS)
	mux.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))
	mux.HandleFunc("/", h.index)

	v1 := mux.PathPrefix("/api/v1").Subrouter()
	v1.HandleFunc("/workers", h.workers)
	v1.HandleFunc("/ws", h.openWS)

	return nil
}

func (h *HttpSrv) Run(ctx context.Context) error {
	go func() {
		<-ctx.Done()

		sdCtx, cancel := context.WithTimeout(context.Background(), time.Second*5)
		defer cancel()
		h.httpServ.Shutdown(sdCtx)
	}()

	log.Printf("observer starting on port %d. Workers - %d", h.port, len(h.workersConf))
	if err := h.httpServ.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}
