import { InjectQueue } from '@nestjs/bull'
import { Injectable, Logger, MessageEvent } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { context, SpanStatusCode, trace } from '@opentelemetry/api'
import { Queue } from 'bull'
import { isHexString } from 'ethers'
import { Observable } from 'rxjs'

import { ExecuteDto } from './execute.dto'
import { ExecuteProcessorErrorMessage, QUEUE_ERRORS } from './execute.errors'
import { getErrorMessage } from '../utils'

export interface TracingOptions {
  traceparent: string
  tracestate: string
}

@Injectable()
export class ExecuteServiceV1 {
  private _tracer = trace.getTracer('ExecuteService')
  private readonly logger = new Logger(ExecuteServiceV1.name)

  constructor(
    private configService: ConfigService,
    @InjectQueue('execute') private readonly executionQueue: Queue
  ) {
    this._verifyPrivateKey()
    this._verifyRedisAvailability()
  }

  async execute(executeDto: ExecuteDto, rootTracingOptions?: TracingOptions) {
    // rootTracingOptions is optional and allows the job consumer work to be
    // attached to a root trace, while the local tracing options can only be
    // used for the work of adding the job to the queue
    return this._tracer.startActiveSpan('execute', (span) => {
      return this._addExecutionJob(executeDto, rootTracingOptions)
        .then(({ id, timestamp }) => {
          span.setStatus({ code: SpanStatusCode.OK })
          return { id, timestamp }
        })
        .catch((error) => {
          const message = getErrorMessage(error)
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message,
          })
        })
        .finally(() => {
          span.end()
        })
    })
  }

  async getJobById(jobId: string) {
    return this._tracer.startActiveSpan('getJobById', async (span) => {
      const job = await this.executionQueue.getJob(jobId)

      if (!job) {
        const failedJob = (await this.executionQueue.getFailed()).find(
          (j) => j.id === jobId
        )

        if (!failedJob) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: QUEUE_ERRORS.JOB_NOT_FOUND,
          })
          span.end()
          throw new Error(QUEUE_ERRORS.JOB_NOT_FOUND)
        }

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: failedJob.failedReason,
        })
        span.end()
        return failedJob
      }

      span.setAttribute('job', JSON.stringify(job))
      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
      return job
    })
  }

  subscribeToJobById(jobId: string) {
    return this._tracer.startActiveSpan('subscribeToJobById', (span) => {
      return new Observable<MessageEvent>((subscriber) => {
        span.setAttribute('jobId', jobId)

        context.with(trace.setSpan(context.active(), span), async () => {
          this.getJobById(jobId)
            .then((job) => {
              const progressListener = (job, progress) => {
                if (job.id === jobId) {
                  this.logger.debug(`Job progress: ${progress}`)
                  span.addEvent('got progress update', { progress })
                  subscriber.next({
                    data: { payload: progress, type: 'progress' },
                  })
                }
              }

              this.executionQueue.on('progress', progressListener)
              job
                .finished()
                .then((payload) => {
                  this.logger.debug(`Job completed!`)
                  this.executionQueue.removeListener(
                    'progress',
                    progressListener
                  )
                  span.setStatus({ code: SpanStatusCode.OK })
                  span.end()
                  subscriber.next({ data: { payload, type: 'completed' } })
                  subscriber.complete()
                })
                .catch((error) => {
                  const message = getErrorMessage(error)
                  span.setStatus({ code: SpanStatusCode.ERROR, message })
                  span.end()
                  subscriber.error(message)
                  subscriber.complete()
                })
            })
            .catch((error) => {
              const message = getErrorMessage(error)
              this.logger.debug(`Job not found!`)
              this.logger.debug(error)
              span.setStatus({ code: SpanStatusCode.ERROR, message })
              span.end()
              subscriber.error(error)
              subscriber.complete()
            })
        })
      })
    })
  }

  private async _addExecutionJob(
    executeDto: ExecuteDto,
    tracingOptions?: TracingOptions
  ) {
    return this.executionQueue.add('execute', { ...executeDto, tracingOptions })
  }

  private _verifyPrivateKey() {
    const privateKey = this.configService.get<string>('PRIVATE_KEY')

    if (!isHexString(privateKey, 32)) {
      throw new Error(ExecuteProcessorErrorMessage.WALLET_INVALID_PRIVATE_KEY)
    }
  }

  private _verifyRedisAvailability(retries = 3) {
    return new Promise((resolve, reject) => {
      const redisStatus = this.executionQueue.client.status
      this.logger.debug(`Redis connection status: ${redisStatus}`)

      if (
        (redisStatus === 'reconnecting' || redisStatus === 'connecting') &&
        retries > 0
      ) {
        this.logger.debug(
          `Retrying Redis connection establishment (${retries})...`
        )
        setTimeout(() => {
          this._verifyRedisAvailability(--retries)
          resolve(null)
        }, 1000)
      } else {
        if (redisStatus !== 'ready') {
          reject(new Error(QUEUE_ERRORS.REDIS_NOT_AVAILABLE))
        }
      }
    })
  }
}
