package app

import (
	"context"
	"errors"
	"fmt"
	"github.com/samber/lo"
	"github.com/sourcegraph/conc"
)

func (w *Worker) startJob(ctx context.Context, testCount int32) error {
	w.logger.InfoContext(ctx, fmt.Sprintf("start worker, test count %d", testCount))

	var err error
	var wg conc.WaitGroup
	for range testCount {
		wg.Go(func() {
			if e := w.runTest(ctx, w.playwrightDir); e != nil {
				w.logger.ErrorContext(ctx, e.Error())
				err = lo.If(err == nil, errors.New("one or more tests failed with an error")).Else(err)
				return
			}
			w.logger.InfoContext(ctx, "test is pass")
		})
	}

	wg.Wait()
	return err
}
