package app

import (
	"context"
	"github.com/samber/lo"
	"github.com/sourcegraph/conc"
	"load_testing/observer/internal/config"
	"load_testing/worker/proto/gen"
	"log"
)

type state string

const (
	stateReady   state = "ready"
	stateRunning state = "running"
	stateOffline state = "offline"
	stateError   state = "error"
)

type WS interface {
	WriteWSMessage(msg string) error
}

type WorkerStatus struct {
	workerID int
	status   gen.WorkerStatus
}

type observer struct {
	workers []*Worker
}

func NewObserver(ws WS, workersConf []config.WorkerConfig) *observer {
	workers := lo.Map(workersConf, func(item config.WorkerConfig, index int) *Worker {
		return &Worker{
			Id:            index + 1,
			ParallelTests: 1,
			Addr:          item.Addr,
			Status:        stateOffline,
			ws:            ws,
		}
	})

	return &observer{
		workers: workers,
	}
}

func (o *observer) Run(ctx context.Context) {
	statusMap := map[gen.WorkerStatus]state{
		gen.WorkerStatus_STATE_READY:   stateReady,
		gen.WorkerStatus_STATE_RUNNING: stateRunning,
		gen.WorkerStatus_STATE_ERROR:   stateError,
	}

	log.Printf("observer starting. Workers - %d", len(o.workers))

	chanStatus := make(chan WorkerStatus)
	var wg conc.WaitGroup

	for _, worker := range o.workers {
		wg.Go(func() {
			worker.grpcStart(ctx, chanStatus)
		})
	}

	go func() {
		for state := range chanStatus {
			for _, worker := range o.workers {
				if worker.Id == state.workerID {
					newState := stateOffline
					if v, ok := statusMap[state.status]; ok {
						newState = v
					}

					worker.ChangeState(newState)
				}
			}
		}
	}()

	wg.Wait()
	close(chanStatus)
}

func (o *observer) Workers() []*Worker {
	return o.workers
}

func (o *observer) WorkerByID(id int) *Worker {
	w, ok := lo.Find(o.workers, func(item *Worker) bool {
		return item.Id == id
	})
	if !ok {
		return nil
	}

	return w
}
