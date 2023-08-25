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
import * as ToposCoreJSON from '@topos-protocol/topos-smart-contracts/artifacts/contracts/topos-core/ToposCore.sol/ToposCore.json'
import * as ToposMessagingJSON from '@topos-protocol/topos-smart-contracts/artifacts/contracts/topos-core/ToposMessaging.sol/ToposMessaging.json'
import * as SubnetRegistratorJSON from '@topos-protocol/topos-smart-contracts/artifacts/contracts/topos-core/SubnetRegistrator.sol/SubnetRegistrator.json'
import {
  SubnetRegistrator,
  ToposCore,
  ToposMessaging,
} from '@topos-protocol/topos-smart-contracts/typechain-types/contracts/topos-core'
import { Job } from 'bull'
import { ethers, providers } from 'ethers'

import { ExecuteDto } from './execute.dto'
import {
  CONTRACT_ERRORS,
  JOB_ERRORS,
  PROVIDER_ERRORS,
  WALLET_ERRORS,
} from './execute.errors'
import { sanitizeURLProtocol } from 'src/utils'

const UNDEFINED_CERTIFICATE_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

@Processor('execute')
export class ExecutionProcessorV1 {
  private readonly logger = new Logger(ExecutionProcessorV1.name)

  constructor(private configService: ConfigService) {}

  @Process('execute')
  async execute(job: Job<ExecuteDto>) {
    const {
      logIndexes,
      messagingContractAddress,
      receiptTrieMerkleProof,
      receiptTrieRoot,
      subnetId,
    } = job.data

    const toposCoreContractAddress = this.configService.get<string>(
      'TOPOS_CORE_PROXY_CONTRACT_ADDRESS'
    )

    const receivingSubnetEndpoint =
      await this._getReceivingSubnetEndpointFromId(subnetId)

    const provider = await this._createProvider(receivingSubnetEndpoint)
    this.logger.debug(`ReceivingSubnet: ${receivingSubnetEndpoint}`)

    const wallet = this._createWallet(provider)

    const toposCoreContract = (await this._getContract(
      provider,
      toposCoreContractAddress,
      ToposCoreJSON.abi,
      wallet
    )) as ToposCore

    const messagingContract = (await this._getContract(
      provider,
      messagingContractAddress,
      ToposMessagingJSON.abi,
      wallet
    )) as ToposMessaging

    this.logger.debug(`Trie root: ${receiptTrieRoot}`)

    let certId = UNDEFINED_CERTIFICATE_ID
    let i = 1

    while (certId == UNDEFINED_CERTIFICATE_ID && i < 40) {
      this.logger.debug(`Waiting for cert to be imported (${i})`)
      certId = await toposCoreContract.receiptRootToCertId(receiptTrieRoot)
      this.logger.debug(`Cert id: ${certId}`)
      await new Promise<void>((r) => setTimeout(r, 1000))
      i++
    }

    if (certId == UNDEFINED_CERTIFICATE_ID) {
      await job.moveToFailed({ message: JOB_ERRORS.MISSING_CERTIFICATE })
      return
    }

    await job.progress(50)

    const tx = await messagingContract.execute(
      logIndexes,
      receiptTrieMerkleProof,
      receiptTrieRoot,
      {
        gasLimit: 4_000_000,
      }
    )

    return tx.wait().then(async (receipt) => {
      await job.progress(100)
      return receipt
    })
  }

  private async _getReceivingSubnetEndpointFromId(subnetId: string) {
    const toposSubnetEndpoint = this.configService.get<string>(
      'TOPOS_SUBNET_ENDPOINT'
    )
    const toposCoreContractAddress = this.configService.get<string>(
      'TOPOS_CORE_PROXY_CONTRACT_ADDRESS'
    )
    const subnetRegistratorContractAddress = this.configService.get<string>(
      'SUBNET_REGISTRATOR_CONTRACT_ADDRESS'
    )

    const provider = await this._createProvider(toposSubnetEndpoint)

    const toposCoreContract = await this._getContract(
      provider,
      toposCoreContractAddress,
      ToposCoreJSON.abi
    )

    const toposSubnetId = await toposCoreContract.networkSubnetId()

    if (subnetId === toposSubnetId) {
      return toposSubnetEndpoint
    } else {
      const subnetRegistratorContract = (await this._getContract(
        provider,
        subnetRegistratorContractAddress,
        SubnetRegistratorJSON.abi
      )) as SubnetRegistrator

      const receivingSubnet = await subnetRegistratorContract.subnets(subnetId)
      return receivingSubnet.endpoint
    }
  }

  private _createProvider(endpoint: string) {
    return new Promise<providers.WebSocketProvider>((resolve, reject) => {
      const provider = new ethers.providers.WebSocketProvider(
        sanitizeURLProtocol('ws', `${endpoint}/ws`)
      )

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

  private _createWallet(provider: providers.WebSocketProvider) {
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
    provider: providers.WebSocketProvider,
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
