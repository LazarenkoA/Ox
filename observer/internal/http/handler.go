package http

import (
	"encoding/json"
	"github.com/samber/lo"
	"html/template"
	"load_testing/observer"
	"load_testing/observer/internal/config"
	"net/http"
)

func (h *HttpSrv) workers(w http.ResponseWriter, r *http.Request) {
	workers := lo.Map(h.workersConf, func(item config.WorkerConfig, index int) WorkerDTO {
		return WorkerDTO{
			Id:     index + 1,
			Addr:   item.Addr,
			Status: "ready",
			Online: true,
		}
	})
	data, err := json.Marshal(workers)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, _ = w.Write(data)
}

func (h *HttpSrv) openWS(w http.ResponseWriter, r *http.Request) {

}

func (h *HttpSrv) index(w http.ResponseWriter, r *http.Request) {
	data := map[string]any{
		"Workers": h.workersConf,
	}

	tmpl := template.Must(template.ParseFS(observer.StaticFS, "static/templates/index.html"))

	if err := tmpl.Execute(w, data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
