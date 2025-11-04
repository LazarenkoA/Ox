package http

import (
	"context"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"io/fs"
	"load_testing/observer"
	"load_testing/observer/internal/app"
	"log"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

type IObserver interface {
	Workers() []*app.Worker
	WorkerByID(id int) *app.Worker
}

type HttpSrv struct {
	port     int
	logger   *slog.Logger
	httpServ *http.Server
	ws       *WSServer
	mx       sync.Mutex
	router   *mux.Router
}

func NewHTTP(port int) *HttpSrv {
	router := mux.NewRouter()

	resp := &HttpSrv{
		port:   port,
		router: router,
		logger: slog.Default(),
		httpServ: &http.Server{
			Addr:              fmt.Sprintf(":%d", port),
			Handler:           router,
			ReadHeaderTimeout: 2 * time.Second,
		},
	}

	return resp
}

func (h *HttpSrv) InitRouts(workers IObserver) error {
	staticFS, err := fs.Sub(observer.StaticFS, "static")
	if err != nil {
		return err
	}

	h.router.Use(loggingMiddleware(h.logger))
	h.router.Use(enableCORS)

	// Отдаём статику (CSS/JS)
	h.router.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))
	h.router.HandleFunc("/", h.index(workers))

	v1 := h.router.PathPrefix("/api/v1").Subrouter()
	v1.HandleFunc("/workers", h.workers(workers))
	v1.HandleFunc("/workers/{id}/start", h.workerStart(workers))
	v1.HandleFunc("/workers/{id}/stop", h.workerStop(workers))
	v1.HandleFunc("/workers/{id}/set_script", h.setScript(workers))
	v1.Handle("/ws", sendWorkersStatus(workers)(http.HandlerFunc(h.openWS)))

	return nil
}

func (h *HttpSrv) Run(ctx context.Context) error {
	go func() {
		<-ctx.Done()

		sdCtx, cancel := context.WithTimeout(context.Background(), time.Second*5)
		defer cancel()
		h.httpServ.Shutdown(sdCtx)
	}()

	log.Printf("http starting on port %d", h.port)
	if err := h.httpServ.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}

func (h *HttpSrv) WriteWSMessage(msg string) error {
	if h.ws != nil && !h.ws.closed.Load() {
		return h.ws.WriteMsg(msg)
	}
	return nil
}
