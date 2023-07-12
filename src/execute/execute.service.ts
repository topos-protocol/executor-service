import { InjectQueue } from '@nestjs/bull'
import { Injectable, Logger, MessageEvent } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bull'
import { ethers } from 'ethers'
import { Observable } from 'rxjs'

import { ExecuteDto } from './execute.dto'
import { QUEUE_ERRORS, WALLET_ERRORS } from './execute.errors'

@Injectable()
export class ExecuteServiceV1 {
  private readonly logger = new Logger(ExecuteServiceV1.name)

  constructor(
    private configService: ConfigService,
    @InjectQueue('execute') private readonly executionQueue: Queue
  ) {
    this._verifyPrivateKey()
    this._verifyRedisAvailability()
  }

  async execute(executeDto: ExecuteDto) {
    const { id, timestamp, ...rest } = await this._addExecutionJob(executeDto)
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

  subscribeToJobById(jobId: string) {
    return new Observable<MessageEvent>((subscriber) => {
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
              const messageEvent: MessageEvent = {
                data: job.failedReason,
              }
              this.logger.debug(`Job failed!`)
              this.logger.debug(job.failedReason)
              subscriber.error(messageEvent)
              subscriber.complete()
            })
        })
        .catch((error) => {
          this.logger.debug(`Job not found!`)
          this.logger.debug(error)
          subscriber.error(error)
          subscriber.complete()
        })
    })
  }

  private async _addExecutionJob(executeDto: ExecuteDto) {
    try {
      return this.executionQueue.add('execute', executeDto)
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
