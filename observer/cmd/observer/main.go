package main

import (
	"context"
	"github.com/alecthomas/kingpin/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/credentials/insecure"
	"load_testing/observer/internal/config"
	"load_testing/observer/internal/http"
	"load_testing/worker/proto/gen"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

var (
	conf string
	kp   *kingpin.Application
)

func init() {
	kp = kingpin.New("load testing observer", "")
	kp.Flag("conf", "путь к конфигурационному файлу").Short('c').StringVar(&conf)
}

func main() {
	kingpin.MustParse(kp.Parse(os.Args[1:]))
	cfg, err := config.LoadConfig(conf)
	if err != nil {
		log.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	go shutdown(cancel)
	go grpcStart(ctx, cfg.Workers)

	go func() {
		time.Sleep(time.Millisecond * 300)
		//utils.OpenBrowser(fmt.Sprintf("http://localhost:%d", cfg.Port))
	}()

	srv, err := http.NewHTTP(cfg.Port, cfg.Workers)
	if err != nil {
		log.Fatal(err)
	}

	err = srv.Run(ctx)
	if err != nil {
		log.Fatal(err)
	}
}

func grpcStart(ctx context.Context, workers []config.WorkerConfig) {
	params := grpc.ConnectParams{
		Backoff: backoff.Config{
			BaseDelay:  1 * time.Second,
			Multiplier: 1.6,
			MaxDelay:   10 * time.Second,
		},
		MinConnectTimeout: 5 * time.Second,
	}

	withTransport := grpc.WithTransportCredentials(insecure.NewCredentials())
	conn, err := grpc.NewClient(":63546", withTransport, grpc.WithConnectParams(params))
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()

	client := gen.NewWorkerClient(conn)

	for {
		stream, err := client.Health(context.Background(), &gen.Empty{})
		if err != nil {
			log.Println(err)
			time.Sleep(time.Second)
			continue
		}

		for {
			msg, err := stream.Recv()
			if err == nil {
				log.Println(msg.Status)
			} else {
				log.Println("ERROR:", err)
				break
			}
		}
	}
}

func shutdown(cancel context.CancelFunc) {
	sigs := make(chan os.Signal, 1)

	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs

	log.Println("shutting down")
	cancel()
}
