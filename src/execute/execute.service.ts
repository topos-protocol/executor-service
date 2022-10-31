import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bull'
import { ethers } from 'ethers'
import { ToposExecutorContract } from 'src/abi/ToposExecutorContract'
import { ExecuteDto } from 'src/execute/execute.dto'
import {
  CONTRACT_ERRORS,
  JOB_ERRORS,
  PROVIDER_ERRORS,
  WALLET_ERRORS,
} from 'src/execute/execute.errors'
import { ExecuteData } from './execute.processor'

@Injectable()
export class ExecuteService {
  constructor(
    private configService: ConfigService,
    @InjectQueue('execute') private readonly executionQueue: Queue
  ) {
    this._verifyPrivateKey()
  }

  async execute(executeDto: ExecuteDto) {
    const { certId, crossSubnetMessage, inclusionProof } = executeDto
    const { contractAddress, receivingSubnetEndpoint } = crossSubnetMessage

    const provider = await this._createProvider(receivingSubnetEndpoint)
    const wallet = this._createWallet(
      provider as ethers.providers.JsonRpcProvider
    )
    const contract = await this._getContract(
      provider,
      contractAddress,
      ToposExecutorContract,
      wallet
    )

    const executeData: ExecuteData = {
      certId,
      contract,
      crossSubnetMessageId: crossSubnetMessage.id,
      inclusionProof,
    }

    const executionJob = await this.executionQueue.add('execute', executeData)

    return executionJob.id
  }

  async getJobById(jobId: string) {
    const job = await this.executionQueue.getJob(jobId)

    if (!job) {
      const failedJob = (await this.executionQueue.getFailed()).find(
        (j) => j.id === jobId
      )

      if (!failedJob) {
        throw new Error(JOB_ERRORS.NOT_FOUND)
      }

      return failedJob
    }

    return job
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

  private _verifyPrivateKey() {
    try {
      this._createWallet(null)
    } catch (error) {
      throw new Error(WALLET_ERRORS.INVALID_PRIVATE_KEY)
    }
  }

  private async _getContract(
    provider: ethers.providers.JsonRpcProvider,
    contractAddress: string,
    contractInterface: ethers.ContractInterface,
    wallet: ethers.Wallet
  ) {
    try {
      const code = await provider.getCode(contractAddress)

      if (code === '0x') {
        throw new Error()
      }

      return new ethers.Contract(contractAddress, contractInterface, wallet)
    } catch (error) {
      throw new Error(CONTRACT_ERRORS.INVALID_CONTRACT)
    }
  }
}
