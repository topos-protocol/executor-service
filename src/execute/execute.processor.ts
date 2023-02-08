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
import { ConfigService } from '@nestjs/config'
import * as ToposCoreJSON from '@toposware/topos-smart-contracts/brownie/build/contracts/ToposCore.json'
import * as SubnetRegistratorJSON from '@toposware/topos-smart-contracts/brownie/build/contracts/SubnetRegistrator.json'
import { Job } from 'bull'
import { ethers } from 'ethers'

import { ExecuteDto } from './execute.dto'
import {
  CONTRACT_ERRORS,
  PROVIDER_ERRORS,
  WALLET_ERRORS,
} from './execute.errors'

// export type ExecuteData = Pick<
//   ExecuteDto,
//   'crossSubnetMessageBytesHex' | 'txTrieMerkleProof' | 'txTrieRoot'
// > & { contract: ethers.Contract }

@Processor('execute')
export class ExecutionProcessorV1 {
  private readonly logger = new Logger(ExecutionProcessorV1.name)

  constructor(private configService: ConfigService) {}

  @Process('execute')
  async execute(job: Job<ExecuteDto>) {
    const {
      txRaw,
      indexOfDataInTxRaw,
      subnetId,
      txTrieMerkleProof,
      txTrieRoot,
    } = job.data

    const toposCoreContractAddress = this.configService.get<string>(
      'TOPOS_CORE_CONTRACT_ADDRESS'
    )
    const receivingSubnet = await this._getReceivingSubnetFromId(subnetId)

    const provider = await this._createProvider(receivingSubnet.endpoint)
    const wallet = this._createWallet(
      provider as ethers.providers.JsonRpcProvider
    )
    const contract = await this._getContract(
      provider,
      toposCoreContractAddress,
      ToposCoreJSON.abi,
      wallet
    )

    const tx: ethers.ContractTransaction = await contract.executeAssetTransfer(
      txRaw,
      // indexOfDataInTxRaw,
      txTrieMerkleProof,
      txTrieRoot
    )
    console.log(tx)

    await tx.wait().then(
      (receipt) => {
        this.logger.debug(':) tx ok on receiving subnet')
        this.logger.debug(receipt)
      },
      (error) => {
        // return error.checkCall().then((error) => {
        this.logger.error(':( tx nok on receiving subnet')
        this.logger.error(error)
        // })
      }
    )
  }

  private async _getReceivingSubnetFromId(subnetId: string) {
    const toposSubnetEndpoint = this.configService.get<string>(
      'TOPOS_SUBNET_ENDPOINT'
    )
    const subnetRegistratorContractAddress = this.configService.get<string>(
      'SUBNET_REGISTRATOR_CONTRACT_ADDRESS'
    )
    const provider = await this._createProvider(toposSubnetEndpoint)
    const contract = await this._getContract(
      provider,
      subnetRegistratorContractAddress,
      SubnetRegistratorJSON.abi
    )

    return contract.subnets(subnetId)
  }

  private _createProvider(
    endpoint: string
  ): Promise<ethers.providers.JsonRpcProvider> {
    return new Promise((resolve, reject) => {
      const provider = new ethers.providers.JsonRpcProvider(endpoint)

      // Fix: Timeout to leave time to errors to be asynchronously caught
      const timeoutId = setTimeout(() => {
        resolve(provider)
      }, 1000)

      provider.on('debug', (data) => {
        if (data.error) {
          clearTimeout(timeoutId)
          reject(new Error(PROVIDER_ERRORS.INVALID_ENDPOINT))
        }
      })
    })
  }

  private _createWallet(provider: ethers.providers.JsonRpcProvider) {
    try {
      return new ethers.Wallet(
        this.configService.get<string>('PRIVATE_KEY'),
        provider
      )
    } catch (error) {
      throw new Error(WALLET_ERRORS.INVALID_PRIVATE_KEY)
    }
  }

  private async _getContract(
    provider: ethers.providers.JsonRpcProvider,
    contractAddress: string,
    contractInterface: ethers.ContractInterface,
    wallet?: ethers.Wallet
  ) {
    try {
      const code = await provider.getCode(contractAddress)

      if (code === '0x') {
        throw new Error()
      }

      return new ethers.Contract(
        contractAddress,
        contractInterface,
        wallet || provider
      )
    } catch (error) {
      throw new Error(CONTRACT_ERRORS.INVALID_CONTRACT)
    }
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
    this.logger.debug(`Job ${jobId} has started`)
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
