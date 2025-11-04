package app

import (
	"context"
	"fmt"
	"github.com/hashicorp/go-multierror"
	"github.com/sourcegraph/conc"
)

func (w *Worker) startJob(ctx context.Context, testCount int32) error {
	w.logger.InfoContext(ctx, fmt.Sprintf("start worker, test count %d", testCount))

	err := new(multierror.Error)
	var wg conc.WaitGroup
	for range testCount {
		wg.Go(func() {
			if e := w.runTest(ctx, w.playwrightDir); e != nil {
				err = multierror.Append(err, e)
				return
			}
			w.logger.InfoContext(ctx, "test is pass")
		})
	}

	wg.Wait()
	return err.ErrorOrNil()
}
