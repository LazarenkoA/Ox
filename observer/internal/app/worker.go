package app

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/pkg/errors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/credentials/insecure"
	"load_testing/worker/proto/gen"
	"log"
	"sync"
	"time"
)

type Worker struct {
	Id            int              `json:"id"`
	Addr          string           `json:"addr"`
	Status        state            `json:"status"`
	Script        string           `json:"script"`
	ParallelTests int              `json:"parallel_tests"`
	ws            WS               `json:"-"`
	client        gen.WorkerClient `json:"-"`
	mx            sync.RWMutex     `json:"-"`
}

func (w *Worker) ChangeState(newState state) {
	w.mx.Lock()
	defer w.mx.Unlock()

	w.Status = newState
	w.sendWorkerToFront()
}

func (w *Worker) sendWorkerToFront() {
	data, _ := json.Marshal(w)
	if err := w.ws.WriteWSMessage(string(data)); err != nil {
		log.Println("WriteWSMessage error:", err)
	}
}

func (w *Worker) Start(testCount int32) error {
	w.mx.Lock()

	if w.Status != stateReady && w.Status != stateError {
		w.mx.Unlock()
		return fmt.Errorf("incorrect worker status. Current state is %s", w.Status)
	}
	w.mx.Unlock()

	w.ChangeState(stateRunning)

	go func() {
		_, err := w.client.Start(context.Background(), &gen.StartResp{TestCount: testCount})
		if err != nil {
			log.Println("start error", err)
		}
	}()

	return nil
}

func (w *Worker) Stop() error {
	_, err := w.client.Stop(context.Background(), &gen.Empty{})
	return err
}

func (w *Worker) SetTestScript(script string) error {
	w.mx.Lock()
	defer w.mx.Unlock()

	w.Script = script
	_, err := w.client.SetTestScript(context.Background(), &gen.TestScript{Script: script})
	return err
}

func (w *Worker) grpcStart(ctx context.Context, chanStatus chan<- WorkerStatus) {
	params := grpc.ConnectParams{
		Backoff: backoff.Config{
			BaseDelay:  1 * time.Second,
			Multiplier: 1.6,
			MaxDelay:   10 * time.Second,
		},
		MinConnectTimeout: 5 * time.Second,
	}

	log.Printf("start GRPC worker %s", w.Addr)

	withTransport := grpc.WithTransportCredentials(insecure.NewCredentials())
	conn, err := grpc.NewClient(w.Addr, withTransport, grpc.WithConnectParams(params))
	if err != nil {
		log.Println(errors.Wrap(err, "grpc newClient").Error())
		return
	}
	defer conn.Close()

	w.client = gen.NewWorkerClient(conn)
	w.grpcKeepalive(ctx, chanStatus)
}

func (w *Worker) syncScript(ctx context.Context) {
	w.mx.Lock()
	defer w.mx.Unlock()

	if w.Script == "" {
		if script, err := w.client.GetTestScript(ctx, &gen.Empty{}); err == nil {
			w.Script = script.Script
		}
	} else {
		_, _ = w.client.SetTestScript(ctx, &gen.TestScript{Script: w.Script})
	}
}

func (w *Worker) grpcKeepalive(ctx context.Context, chanStatus chan<- WorkerStatus) {
	for {
		stream, err := w.client.ObserverChangeState(ctx, &gen.Empty{})
		if err != nil {
			log.Println("GRPC error:", err)
		} else {
			// сразу при подключении синкаем скрипт потому что мог быть перезагружен воркер тогда мы скрипт отдает
			// а мог быть перезагружен observer тогда мы скрипт забираем
			w.syncScript(ctx)

			chanStatus <- WorkerStatus{workerID: w.Id, status: gen.WorkerStatus_STATE_READY}
			w.readStream(stream, w.Id, chanStatus)
		}

		chanStatus <- WorkerStatus{workerID: w.Id, status: -1}
		select {
		case <-ctx.Done():
			log.Println("GRPC: Context done")
			return
		case <-time.After(time.Second * 3):
		}
	}
}

func (w *Worker) readStream(stream grpc.ServerStreamingClient[gen.StatusInfo], workerId int, chanStatus chan<- WorkerStatus) {
	for {
		msg, err := stream.Recv()
		if err == nil {
			chanStatus <- WorkerStatus{workerID: workerId, status: msg.Status}
		} else {
			log.Println("stream ERROR:", err)
			break
		}
	}
}
