package app

import (
	"context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"load_testing/worker/proto/gen"
	"log"
	"time"
)

type Worker struct {
	gen.UnsafeWorkerServer
}

func NewWorker() *Worker {
	return &Worker{}
}

func (w *Worker) SetTestScript(context.Context, *gen.SetTestScriptReq) (*gen.Empty, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SetTestScript not implemented")
}
func (w *Worker) Start(context.Context, *gen.Empty) (*gen.StartResp, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Start not implemented")
}
func (w *Worker) Stop(context.Context, *gen.Empty) (*gen.Empty, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Stop not implemented")
}
func (w *Worker) Health(_ *gen.Empty, stream grpc.ServerStreamingServer[gen.HealthResp]) error {
	for {
		err := stream.Send(&gen.HealthResp{
			Status: gen.WorkerStatus_READY,
		})

		if err != nil {
			log.Println("ERROR:", err)
			return err
		}

		time.Sleep(time.Second)
	}

	return nil
}
