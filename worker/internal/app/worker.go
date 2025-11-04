package app

import (
	"context"
	"github.com/pkg/errors"
	"github.com/pterm/pterm"
	"google.golang.org/grpc"
	"load_testing/worker/internal/utils"
	"load_testing/worker/proto/gen"
	"log/slog"
	"os"
	"path/filepath"
)

type Worker struct {
	gen.UnsafeWorkerServer

	state         chan gen.WorkerStatus
	cancelJob     context.CancelFunc
	playwrightDir string
	script        string
	logger        *slog.Logger
}

func NewWorker() *Worker {
	return &Worker{
		state:     make(chan gen.WorkerStatus, 1),
		cancelJob: func() {},
		logger:    utils.Logger().With("name", "worker"),
	}
}

func (w *Worker) Init(ctx context.Context) error {
	utils.Logger().Info("init worker")

	multi := pterm.DefaultMultiPrinter
	multi.Start()

	spinner, _ := pterm.DefaultSpinner.WithWriter(multi.NewWriter()).Start("Установка playwright")
	if err := w.install(ctx); err != nil {
		spinner.Fail(err.Error())
		return err
	}
	spinner.Success("playwright установлен")

	dir, _ := os.Getwd()
	w.playwrightDir = filepath.Join(dir, "playwright")
	if !dirExists(w.playwrightDir) {
		spinner, _ := pterm.DefaultSpinner.WithWriter(multi.NewWriter()).Start("Подготовка playwright")
		if err := w.create(ctx, w.playwrightDir); err != nil {
			spinner.Fail(err.Error())
			return err
		}

		spinner.Success("playwright подготовлен")
	}

	multi.Stop()

	return nil
}

func dirExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func (w *Worker) SetTestScript(_ context.Context, req *gen.SetTestScriptReq) (*gen.Empty, error) {
	w.script = req.Script

	return new(gen.Empty), nil
}

func (w *Worker) Start(ctxParent context.Context, resp *gen.StartResp) (_ *gen.Empty, err error) {
	defer func() {
		if err != nil {
			w.logger.ErrorContext(ctxParent, errors.Wrap(err, "start error").Error())
			w.state <- gen.WorkerStatus_STATE_ERROR
		} else {
			w.state <- gen.WorkerStatus_STATE_READY
		}
	}()

	w.state <- gen.WorkerStatus_STATE_RUNNING

	ctx, cancel := context.WithCancel(ctxParent)
	w.cancelJob = cancel

	if err := w.startJob(ctx, resp.TestCount); err != nil {
		return nil, err
	}

	return new(gen.Empty), nil
}

func (w *Worker) Stop(context.Context, *gen.Empty) (*gen.Empty, error) {
	w.cancelJob()
	return new(gen.Empty), nil
}

func (w *Worker) ObserverChangeState(_ *gen.Empty, stream grpc.ServerStreamingServer[gen.StatusInfo]) error {
	for state := range w.state {
		err := stream.Send(&gen.StatusInfo{
			Status: state,
		})

		if err != nil {
			w.logger.Error(errors.Wrap(err, "stream send error").Error())
			return err
		}
	}

	return nil
}
