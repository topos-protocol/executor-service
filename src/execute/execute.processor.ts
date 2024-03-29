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
import {
  context,
  metrics,
  propagation,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api'
import {
  SubnetRegistrator,
  ToposCore,
  ToposMessaging,
} from '@topos-protocol/topos-smart-contracts/typechain-types'
import * as ToposCoreJSON from '@topos-protocol/topos-smart-contracts/artifacts/contracts/topos-core/ToposCore.sol/ToposCore.json'
import * as ToposMessagingJSON from '@topos-protocol/topos-smart-contracts/artifacts/contracts/topos-core/ToposMessaging.sol/ToposMessaging.json'
import * as SubnetRegistratorJSON from '@topos-protocol/topos-smart-contracts/artifacts/contracts/topos-core/SubnetRegistrator.sol/SubnetRegistrator.json'
import { Job } from 'bull'
import {
  Contract,
  ContractTransaction,
  getDefaultProvider,
  Interface,
  InterfaceAbi,
  Provider,
  Wallet,
} from 'ethers'

import { getErrorMessage } from '../utils'
import { ExecuteDto } from './execute.dto'
import {
  ExecuteError,
  ExecuteProcessorError,
  ExecuteTransactionError,
} from './execute.errors'
import { TracingOptions } from './execute.service'

const UNDEFINED_CERTIFICATE_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

@Processor('execute')
export class ExecutionProcessorV1 {
  private _tracer = trace.getTracer('ExecuteProcessor')
  private _meter = metrics.getMeter('ExecuteProcessor')
  private _counterExecute = this._meter.createCounter(
    'execute_processor.execute.counter'
  )
  private readonly logger = new Logger(ExecutionProcessorV1.name)

  constructor(private configService: ConfigService) {}

  @Process('execute')
  async execute(job: Job<ExecuteDto & { tracingOptions: TracingOptions }>) {
    const activeContext = propagation.extract(
      context.active(),
      job.data.tracingOptions
    )

    return context.with(activeContext, async () => {
      return this._tracer.startActiveSpan('execute', async (span) => {
        try {
          this._counterExecute.add(1)
          const {
            logIndexes,
            messagingContractAddress,
            receiptTrieMerkleProof,
            receiptTrieRoot,
            subnetId,
          } = job.data

          span.setAttribute('data', JSON.stringify(job.data))

          const toposCoreProxyContractAddress = this.configService.get(
            'TOPOS_CORE_PROXY_CONTRACT_ADDRESS'
          )
          span.setAttribute(
            'toposCoreProxyContractAddress',
            toposCoreProxyContractAddress
          )

          const receivingSubnetEndpoint =
            await this._getReceivingSubnetEndpointFromId(subnetId)
          span.addEvent('got receiving subnet endpoint from id', {
            subnetId,
            receivingSubnetEndpoint,
          })

          const provider = await this._createProvider(receivingSubnetEndpoint)
          this.logger.debug(`ReceivingSubnet: ${receivingSubnetEndpoint}`)

          span.addEvent('got provider', {
            provider: JSON.stringify(provider),
          })

          const wallet = this._createWallet(provider)

          const toposCoreContract = (await this._getContract(
            provider,
            toposCoreProxyContractAddress,
            ToposCoreJSON.abi,
            wallet
          )) as unknown as ToposCore

          const messagingContract = (await this._getContract(
            provider,
            messagingContractAddress,
            ToposMessagingJSON.abi,
            wallet
          )) as unknown as ToposMessaging

          this.logger.debug(`Trie root: ${receiptTrieRoot}`)

          const certId = await this._findMatchingCertificate(
            toposCoreContract,
            receiptTrieRoot
          )
          span.addEvent('got matching certificate id', { certId })

          await job.progress(50)

          const transaction = await this._createExecuteTransaction(
            messagingContract,
            logIndexes,
            receiptTrieMerkleProof,
            receiptTrieRoot
          )

          await this._catchToposMessagingExecuteTransactionError(
            provider,
            transaction
          )

          const transactionResponse = await wallet.sendTransaction(transaction)

          span.addEvent('got execute transaction response', {
            transaction: JSON.stringify(transactionResponse),
          })

          const receipt = await transactionResponse.wait()
          span.addEvent('got execute transaction receipt', {
            receipt: JSON.stringify(receipt),
          })

          job.progress(100)
          span.setStatus({ code: SpanStatusCode.OK })
          span.end()
          return receipt
        } catch (error) {
          const message = getErrorMessage(error)
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message,
          })
          span.end()
          await job.moveToFailed({ message })
        }
      })
    })
  }

  private async _getReceivingSubnetEndpointFromId(subnetId: string) {
    const toposSubnetEndpoint = this.configService.get<string>(
      'TOPOS_SUBNET_ENDPOINT_WS'
    )
    const toposCoreContractAddress = this.configService.get<string>(
      'TOPOS_CORE_PROXY_CONTRACT_ADDRESS'
    )
    const subnetRegistratorContractAddress = this.configService.get<string>(
      'SUBNET_REGISTRATOR_CONTRACT_ADDRESS'
    )

    const provider = await this._createProvider(toposSubnetEndpoint)

    const toposCoreContract = (await this._getContract(
      provider,
      toposCoreContractAddress,
      ToposCoreJSON.abi
    )) as unknown as ToposCore

    const toposSubnetId = await toposCoreContract.networkSubnetId()

    if (subnetId === toposSubnetId) {
      return toposSubnetEndpoint
    } else {
      const subnetRegistratorContract = (await this._getContract(
        provider,
        subnetRegistratorContractAddress,
        SubnetRegistratorJSON.abi
      )) as unknown as SubnetRegistrator

      const receivingSubnet = await subnetRegistratorContract.subnets(subnetId)
      return receivingSubnet.endpointWs || receivingSubnet.endpointHttp
    }
  }

  private _createProvider(endpoint: string) {
    return new Promise<Provider>((resolve, reject) => {
      const provider = getDefaultProvider(endpoint)

      // Fix: Timeout to leave time to errors to be asynchronously caught
      const timeoutId = setTimeout(() => {
        resolve(provider)
      }, 1000)

      provider.on('debug', (data) => {
        if (data.error) {
          clearTimeout(timeoutId)
          reject(
            new ExecuteError(ExecuteProcessorError.PROVIDER_INVALID_ENDPOINT)
          )
        }
      })
    })
  }

  private _createWallet(provider: Provider) {
    try {
      const privateKey = this.configService.getOrThrow('PRIVATE_KEY')
      return new Wallet(privateKey, provider)
    } catch (error) {
      throw new ExecuteError(ExecuteProcessorError.WALLET_INVALID_PRIVATE_KEY)
    }
  }

  private async _getContract(
    provider: Provider,
    contractAddress: string,
    contractInterfaceAbi: InterfaceAbi,
    wallet?: Wallet
  ) {
    try {
      const code = await provider.getCode(contractAddress)

      if (code === '0x') {
        throw new ExecuteError(ExecuteProcessorError.CONTRACT_INVALID_NO_CODE)
      }

      return new Contract(
        contractAddress,
        contractInterfaceAbi,
        wallet || provider
      )
    } catch (error) {
      if (error instanceof ExecuteError) {
        throw error
      }

      throw new ExecuteError(ExecuteProcessorError.CONTRACT_INVALID_ADDRESS)
    }
  }

  private async _findMatchingCertificate(
    toposCoreContract: ToposCore,
    receiptTrieRoot: string
  ) {
    let certId = UNDEFINED_CERTIFICATE_ID
    let i = 1
    const maxTries = 80

    while (certId == UNDEFINED_CERTIFICATE_ID && i < maxTries) {
      this.logger.debug(`Waiting for cert to be imported (${i})`)
      certId = await toposCoreContract.receiptRootToCertId(receiptTrieRoot)
      this.logger.debug(`Cert id: ${certId}`)
      await new Promise<void>((r) => setTimeout(r, 1000))
      i++
    }

    if (certId == UNDEFINED_CERTIFICATE_ID) {
      throw new ExecuteError(ExecuteProcessorError.CERTIFICATE_NOT_FOUND)
    }

    return certId
  }

  private _createExecuteTransaction(
    messagingContract: ToposMessaging,
    logIndexes: number[],
    receiptTrieMerkleProof: string,
    receiptTrieRoot: string
  ) {
    try {
      return messagingContract.execute.populateTransaction(
        logIndexes,
        receiptTrieMerkleProof,
        receiptTrieRoot,
        {
          gasLimit: 4_000_000,
        }
      )
    } catch (error) {
      throw new ExecuteError(
        ExecuteProcessorError.EXECUTE_TRANSACTION_FAILED_INIT
      )
    }
  }

  private async _catchToposMessagingExecuteTransactionError(
    provider: Provider,
    transaction: ContractTransaction
  ) {
    try {
      await provider.call(transaction)
    } catch (error) {
      if (error.data) {
        const iface = new Interface(ToposMessagingJSON.abi)
        const decodedError = iface.parseError(error.data)

        const transactionError: ExecuteTransactionError = {
          decoded: Boolean(decodedError),
          data: decodedError?.name || error.data,
        }

        throw new ExecuteError(
          ExecuteProcessorError.EXECUTE_TRANSACTION_REVERT,
          JSON.stringify(transactionError)
        )
      }
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
