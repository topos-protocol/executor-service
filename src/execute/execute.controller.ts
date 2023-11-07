import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  context,
  metrics,
  propagation,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api'
import { tap } from 'rxjs'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { getErrorMessage } from '../utils'
import { ExecuteDto } from './execute.dto'
import { ExecuteServiceV1, TracingOptions } from './execute.service'

@Controller({ version: '1' })
export class ExecuteControllerV1 {
  private _tracer = trace.getTracer('ExecuteController')
  private _meter = metrics.getMeter('ExecuteController')
  private _counterExecute = this._meter.createCounter(
    'execute_controller.execute.counter'
  )
  private _counterGetJob = this._meter.createCounter('getJob.counter')
  private _counterSubscribeToJob = this._meter.createCounter(
    'subscribeToJob.counter'
  )
  constructor(private executeService: ExecuteServiceV1) {}

  @ApiTags('execute')
  @Post('execute')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async executeV1(
    @Body() executeDto: ExecuteDto,
    // rootTracingOptions is optional and allows the job consumer work to be
    // attached to a root trace, while the local tracing options can only be
    // used for the work of adding the job to the queue
    @Headers('rootTraceparent') rootTraceparent?: string,
    @Headers('rootTracestate') rootTracestate?: string,
    @Headers('traceparent') traceparent?: string,
    @Headers('tracestate') tracestate?: string
  ) {
    this._counterExecute.add(1)

    const activeContext = propagation.extract(context.active(), {
      traceparent,
      tracestate,
    })

    const rootTracingOptions: TracingOptions = {
      traceparent: rootTraceparent,
      tracestate: rootTracestate,
    }

    return context.with(activeContext, async () => {
      return this._tracer.startActiveSpan('execute', async (span) => {
        const job = await this.executeService.execute(
          executeDto,
          rootTracingOptions
        )
        span.end()
        return job
      })
    })
  }

  @ApiTags('job')
  @Get('job/:jobId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'jobId' })
  async getJob(@Param('jobId') jobId: string) {
    this._counterGetJob.add(1)
    return this.executeService.getJobById(jobId)
  }

  @ApiTags('job')
  @Sse('job/subscribe/:jobId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'jobId' })
  async subscribeToJob(
    @Param('jobId') jobId: string,
    @Headers('traceparent') traceparent?: string,
    @Headers('tracestate') tracestate?: string
  ) {
    this._counterSubscribeToJob.add(1)

    const activeContext = propagation.extract(context.active(), {
      traceparent,
      tracestate,
    })

    return context.with(activeContext, async () => {
      return this._tracer.startActiveSpan('subscribeToJob', async (span) => {
        const observable = this.executeService.subscribeToJobById(jobId)
        return observable.pipe(
          tap({
            error: (error) => {
              const message = getErrorMessage(error)
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message,
              })
              span.end()
            },
            complete: () => {
              span.setStatus({ code: SpanStatusCode.OK })
              span.end()
            },
          })
        )
      })
    })
  }
}
