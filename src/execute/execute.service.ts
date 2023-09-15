import { InjectQueue } from '@nestjs/bull'
import { Injectable, Logger, MessageEvent } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bull'
import { ethers } from 'ethers'
import { Observable } from 'rxjs'

import { ApmService } from '../apm/apm.service'
import { ExecuteDto } from './execute.dto'
import { QUEUE_ERRORS, WALLET_ERRORS } from './execute.errors'

export interface TracingOptions {
  traceparent?: string
}

@Injectable()
export class ExecuteServiceV1 {
  private readonly logger = new Logger(ExecuteServiceV1.name)

  constructor(
    private configService: ConfigService,
    private apmService: ApmService,
    @InjectQueue('execute') private readonly executionQueue: Queue
  ) {
    this._verifyPrivateKey()
    this._verifyRedisAvailability()
  }

  async execute(executeDto: ExecuteDto, tracingOptions: TracingOptions) {
    const traceparent = tracingOptions?.traceparent

    const apmTransaction = this.apmService.startTransaction(
      'root-execute',
      traceparent
    )
    const span = apmTransaction.startSpan(`add-execution-job`)

    const { id, timestamp, ...rest } = await this._addExecutionJob(executeDto, {
      traceparent,
    })
    span.addLabels({ id, timestamp })

    span.end()
    apmTransaction.end()
    return { id, timestamp }
  }

  async getJobById(jobId: string) {
    const job = await this.executionQueue.getJob(jobId)

    if (!job) {
      const failedJob = (await this.executionQueue.getFailed()).find(
        (j) => j.id === jobId
      )

      if (!failedJob) {
        throw new Error(QUEUE_ERRORS.JOB_NOT_FOUND)
      }

      return failedJob
    }

    return job
  }

  subscribeToJobById(jobId: string, tracingOptions: TracingOptions) {
    return new Observable<MessageEvent>((subscriber) => {
      const traceparent = tracingOptions?.traceparent
      const apmTransaction = this.apmService.startTransaction(
        'root-subscribe',
        traceparent
      )
      const span = apmTransaction.startSpan(`subscribe-to-job`)
      span.addLabels({ jobId })

      this.getJobById(jobId)
        .then((job) => {
          const progressListener = (job, progress) => {
            if (job.id === jobId) {
              this.logger.debug(`Job progress: ${progress}`)
              subscriber.next({ data: { payload: progress, type: 'progress' } })
            }
          }

          this.executionQueue.on('progress', progressListener)
          job
            .finished()
            .then((payload) => {
              this.logger.debug(`Job completed!`)
              this.executionQueue.removeListener('progress', progressListener)
              subscriber.next({ data: { payload, type: 'completed' } })
              subscriber.complete()
            })
            .catch((error) => {
              this.apmService.captureError(error)
              this.logger.debug(`Job failed!`)
              this.logger.debug(error)
              subscriber.error(error)
              subscriber.complete()
            })
            .finally(() => {
              span.end()
            })
        })
        .catch((error) => {
          this.apmService.captureError(error)
          this.logger.debug(`Job not found!`)
          this.logger.debug(error)
          subscriber.error(error)
          subscriber.complete()
        })
    })
  }

  private async _addExecutionJob(
    executeDto: ExecuteDto,
    { traceparent }: TracingOptions
  ) {
    try {
      return this.executionQueue.add('execute', { ...executeDto, traceparent })
    } catch (error) {
      this.logger.error(error)
    }
  }

  private _verifyPrivateKey() {
    const privateKey = this.configService.get<string>('PRIVATE_KEY')

    if (!ethers.utils.isHexString(privateKey, 32)) {
      throw new Error(WALLET_ERRORS.INVALID_PRIVATE_KEY)
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
