import {
  OnGlobalQueueActive,
  OnGlobalQueueCompleted,
  OnGlobalQueueError,
  OnGlobalQueueFailed,
  OnGlobalQueueProgress,
  OnGlobalQueueStalled,
  OnGlobalQueueWaiting,
  Process,
  Processor,
} from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { ethers } from 'ethers'

import { ExecuteDto } from './execute.dto'

export interface ExecuteData {
  certId: ExecuteDto['certId']
  contract: ethers.Contract
  crossSubnetMessageId: ExecuteDto['crossSubnetMessage']['id']
  inclusionProof: ExecuteDto['inclusionProof']
}

@Processor('execute')
export class ExecutionProcessor {
  private readonly logger = new Logger(ExecutionProcessor.name)

  @Process('execute')
  async execute(job: Job<ExecuteData>) {
    const { certId, contract, crossSubnetMessageId, inclusionProof } = job.data

    return contract
      .executeArbitraryCall(certId, crossSubnetMessageId, inclusionProof)
      .then((tx: ethers.ContractTransaction) => {
        return tx.wait().then(
          (receipt) => {
            return true
          },
          (error) => {
            return error.checkCall().then((error) => {
              return false
            })
          }
        )
      })
  }

  @OnGlobalQueueError()
  onGlobalQueueError(error: Error) {
    this.logger.error(error)
  }

  @OnGlobalQueueFailed()
  onGlobalQueueFailed(jobId: string, error: Error) {
    this.logger.error(`Job ${jobId} has failed with error:`)
    this.logger.error(error)
  }

  @OnGlobalQueueWaiting()
  onGlobalQueueWaiting(jobId: string) {
    this.logger.debug(`Job ${jobId} is waiting in the queue`)
  }

  @OnGlobalQueueActive()
  onGlobalQueueActive(jobId: string) {
    this.logger.log(`Job ${jobId} has started`)
  }

  @OnGlobalQueueStalled()
  onGlobalQueueStalled(jobId: string) {
    this.logger.debug(`Job ${jobId} has stalled`)
  }

  @OnGlobalQueueProgress()
  onGlobalQueueProgress(jobId: string, progress: number) {
    this.logger.debug(`Job ${jobId} is progressing (${progress}%...)`)
  }

  @OnGlobalQueueCompleted()
  onGlobalQueueCompleted(jobId: string, result: any) {
    this.logger.debug(`Job ${jobId} has completed with result:`)
    this.logger.debug(result)
  }
}
