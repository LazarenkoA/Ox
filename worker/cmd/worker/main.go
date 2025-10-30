// worker/main.go (фрагмент)
package main

import (
	"context"
	"github.com/alecthomas/kingpin/v2"
	"load_testing/worker/grpc"
	"load_testing/worker/internal/app"
	"log"
	"os"
	"os/signal"
	"syscall"
)

//go:generate protoc  --proto_path=../../proto --go_out=../../proto --go-grpc_out=../../proto worker.proto
// go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

var (
	port int
	kp   *kingpin.Application
)

func init() {
	kp = kingpin.New("load testing worker", "")
	kp.Flag("port", "порт который будет слушать приложение").Short('p').IntVar(&port)
}

func main() {
	kingpin.MustParse(kp.Parse(os.Args[1:]))

	if port == 0 {
		log.Fatal("the port must be fill")
	}

	ctx, cancel := context.WithCancel(context.Background())
	go shutdown(cancel)

	err := grpc.NewGRPCServer(ctx, port, app.NewWorker())
	if err != nil {
		log.Fatal(err)
	}
}

func shutdown(cancel context.CancelFunc) {
	sigs := make(chan os.Signal, 1)

	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs

	log.Println("shutting down")
	cancel()
}
