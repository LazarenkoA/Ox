package app

import (
	"context"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/samber/lo"
	"github.com/sourcegraph/conc"
)

func (w *Worker) startJob(ctx context.Context, testCount int32) error {
	w.logger.InfoContext(ctx, fmt.Sprintf("start worker, test count %d", testCount))

	var err error
	var wg conc.WaitGroup
	for range testCount {
		wg.Go(func() {
			jobID := uuid.NewString()
			if e := w.runTest(ctx, jobID, w.playwrightDir); e != nil {
				w.logger.ErrorContext(ctx, e.Error(), "job_id", jobID)
				err = lo.If(err == nil, errors.New("one or more tests failed with an error")).Else(err)
				return
			}
			w.logger.InfoContext(ctx, "test is pass", "job_id", jobID)
		})
	}

	wg.Wait()
	return err
}
