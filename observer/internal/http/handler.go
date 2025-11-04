package http

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"html/template"
	"io"
	"load_testing/observer"
	"net/http"
	"strconv"
)

func (h *HttpSrv) workers(workers IObserver) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := json.Marshal(workers.Workers())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		_, _ = w.Write(data)
	}
}

func (h *HttpSrv) workerStart(workers IObserver) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		idStr := vars["id"]
		testCountStr := r.URL.Query().Get("testCount")
		id, _ := strconv.Atoi(idStr)
		testCount, _ := strconv.Atoi(testCountStr)

		if worker := workers.WorkerByID(id); worker != nil {
			if err := worker.Start(int32(max(testCount, 1))); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
		} else {
			http.Error(w, fmt.Sprintf("worker not found by ID: %s", idStr), http.StatusInternalServerError)
		}
	}
}

func (h *HttpSrv) workerStop(workers IObserver) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		idStr := vars["id"]
		id, _ := strconv.Atoi(vars["id"])

		if worker := workers.WorkerByID(id); worker != nil {
			if err := worker.Stop(); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
		} else {
			http.Error(w, fmt.Sprintf("worker not found by ID: %s", idStr), http.StatusInternalServerError)
		}
	}
}

func (h *HttpSrv) openWS(w http.ResponseWriter, r *http.Request) {
	h.mx.Lock()
	defer h.mx.Unlock()

	if h.ws != nil && !h.ws.closed.Load() {
		return
	}

	h.ws = NewWSServer(context.Background())
	err := h.ws.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, errors.Wrap(err, "ws open").Error(), http.StatusInternalServerError)
		return
	}
}

func (h *HttpSrv) index(workers IObserver) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		data := map[string]any{
			"Workers": workers.Workers(),
		}

		tmpl := template.Must(template.ParseFS(observer.StaticFS, "static/templates/index.html"))

		if err := tmpl.Execute(w, data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func (h *HttpSrv) setScript(workers IObserver) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusInternalServerError)
			return
		}

		data, _ := io.ReadAll(r.Body)
		defer r.Body.Close()

		vars := mux.Vars(r)
		idStr := vars["id"]
		id, _ := strconv.Atoi(idStr)

		if worker := workers.WorkerByID(id); worker != nil {
			if err := worker.SetTestScript(string(data)); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
		} else {
			http.Error(w, fmt.Sprintf("worker not found by ID: %s", idStr), http.StatusInternalServerError)
		}
	}
}
