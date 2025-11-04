package main

import (
	"context"
	"github.com/alecthomas/kingpin/v2"
	"load_testing/observer/internal/app"
	"load_testing/observer/internal/config"
	"load_testing/observer/internal/http"
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

	go func() {
		time.Sleep(time.Millisecond * 300)
		//utils.OpenBrowser(fmt.Sprintf("http://localhost:%d", cfg.Port))
	}()

	srv := http.NewHTTP(cfg.Port)
	observ := app.NewObserver(srv, cfg.Workers)
	err = srv.InitRouts(observ)
	check(err)

	go observ.Run(ctx)
	check(srv.Run(ctx))
}

func check(err error) {
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
