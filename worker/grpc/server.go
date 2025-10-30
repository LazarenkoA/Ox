package grpc

import (
	"context"
	"fmt"
	grpc_recovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
	"google.golang.org/grpc"
	"load_testing/worker/proto/gen"
	"log"
	"net"
)

func NewGRPCServer(ctx context.Context, port int, worker gen.WorkerServer) error {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port)) // :0 для случайного порта
	if err != nil {
		return err
	}
	actualAddr := listener.Addr().String() // ip:port

	srv := grpc.NewServer(grpc.ChainStreamInterceptor(grpc_recovery.StreamServerInterceptor()))
	gen.RegisterWorkerServer(srv, worker)

	go func() {
		<-ctx.Done()
		srv.Stop()
	}()

	log.Println("сервер запущен на", actualAddr)
	return srv.Serve(listener)
}
