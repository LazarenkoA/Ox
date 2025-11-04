package grpc

import (
	"context"
	"fmt"
	grpc_recovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
	"google.golang.org/grpc"
	"load_testing/worker/internal/utils"
	"load_testing/worker/proto/gen"
	"log/slog"
	"net"
)

func NewGRPCServer(ctx context.Context, port int, worker gen.WorkerServer) error {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port)) // :0 для случайного порта
	if err != nil {
		return err
	}
	actualAddr := listener.Addr().String() // ip:port

	logger := utils.Logger().With("name", "grpc")

	srv := grpc.NewServer(grpc.ChainUnaryInterceptor(logInterceptor(logger)), grpc.ChainStreamInterceptor(grpc_recovery.StreamServerInterceptor()))
	gen.RegisterWorkerServer(srv, worker)

	go func() {
		<-ctx.Done()
		srv.Stop()
	}()

	logger.InfoContext(ctx, fmt.Sprintf("сервер запущен на %s", actualAddr))
	return srv.Serve(listener)
}

func logInterceptor(logger *slog.Logger) func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
		_, err = handler(ctx, req)
		if err != nil {
			logger.ErrorContext(ctx, "grpc error", "error", err)
		} else {
			logger.InfoContext(ctx, fmt.Sprintf("grpc method %s", info.FullMethod))
		}

		return
	}
}
