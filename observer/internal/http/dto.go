package http

type WorkerDTO struct {
	Id     int    `json:"id"`
	Addr   string `json:"addr"`
	Status string `json:"status"`
	Online bool   `json:"online"`
}
