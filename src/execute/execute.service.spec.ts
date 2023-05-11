import { ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { Test, TestingModule } from '@nestjs/testing'
import { ethers } from 'ethers'
import { EventEmitter } from 'stream'

import { ToposExecutorContract } from '../abi/ToposExecutorContract'
import { ExecuteDto } from './execute.dto'
import {
  CONTRACT_ERRORS,
  PROVIDER_ERRORS,
  WALLET_ERRORS,
} from './execute.errors'
import { ExecuteServiceV1 } from './execute.service'
import { AllExceptionsFilter } from '../filters/all-exceptions.filter'
import { BullModule } from '@nestjs/bull'

const VALID_PRIVATE_KEY =
  'c6cbd7d76bc5baca530c875663711b947efa6a86a900a9e8645ce32e5821484e'

const validExecuteDto: ExecuteDto = {
  certId: 'certId',
  crossSubnetMessage: {
    args: [],
    contractAddress: 'address',
    id: 'id',
    method: 'method',
    receivingSubnetEndpoint: 'endpoint',
  },
  inclusionProof: new Uint8Array(),
}

const providerMock = new EventEmitter()
const walletMock = {}
const transactionMock = { wait: jest.fn(() => Promise.resolve({})) }
const contractMock = {
  executeArbitraryCall: jest.fn(() => Promise.resolve(transactionMock)),
}

describe('AppService', () => {
  let app: TestingModule
  let executeService: ExecuteServiceV1
  let configService: ConfigService

  beforeEach(async () => {
    app = await Test.createTestingModule({
      imports: [BullModule.registerQueue({ name: 'execute' })],
      providers: [
        ExecuteServiceV1,
        {
          provide: APP_FILTER,
          useClass: AllExceptionsFilter,
        },
      ],
    })
      .useMocker((token) => {
        if (token === ConfigService) {
          return {
            get: jest.fn().mockReturnValue(VALID_PRIVATE_KEY),
          }
        }
      })
      .compile()

    executeService = app.get(ExecuteServiceV1)
    configService = app.get(ConfigService)
  })

  describe('execute', () => {
    it('should correctly call ethers API when input is correct', async () => {
      const ethersProviderMock = jest
        .spyOn<any, any>(ethers.providers, 'WebSocketProvider')
        .mockReturnValue(providerMock)

      const ethersWalletMock = jest
        .spyOn<any, any>(ethers, 'Wallet')
        .mockReturnValue(walletMock)

      const ethersContractMock = jest
        .spyOn<any, any>(ethers, 'Contract')
        .mockReturnValue(contractMock)

      await executeService.execute(validExecuteDto)

      expect(ethersProviderMock).toHaveBeenCalledWith(
        validExecuteDto.crossSubnetMessage.receivingSubnetEndpoint
      )

      expect(ethersWalletMock).toHaveBeenCalledWith(
        VALID_PRIVATE_KEY,
        providerMock
      )

      expect(ethersContractMock).toHaveBeenCalledWith(
        validExecuteDto.crossSubnetMessage.contractAddress,
        ToposExecutorContract,
        walletMock
      )
    })
  })

  describe('execute|provider', () => {
    it('should throw provider endpoint error if provider emits debug error', async () => {
      const executeDto = {
        ...validExecuteDto,
        crossSubnetMessage: {
          ...validExecuteDto.crossSubnetMessage,
          receivingSubnetEndpoint: '',
        },
      }

      jest
        .spyOn<any, any>(ethers.providers, 'JsonRpcProvider')
        .mockImplementation((endpoint: string) => {
          const eventEmitter = new EventEmitter()

          if (!endpoint) {
            setTimeout(() => {
              eventEmitter.emit('debug', { error: {} })
            }, 0)
          }

          return eventEmitter
        })

      await expect(executeService.execute(executeDto)).rejects.toEqual(
        new Error(PROVIDER_ERRORS.INVALID_ENDPOINT)
      )
    })
  })

  describe('execute|wallet', () => {
    it('should throw wallet error if private key is invalid', async () => {
      jest
        .spyOn<any, any>(ethers.providers, 'JsonRpcProvider')
        .mockReturnValue(providerMock)

      jest.spyOn<any, any>(ethers, 'Wallet').mockImplementationOnce(() => {
        throw new Error()
      })

      await expect(executeService.execute(validExecuteDto)).rejects.toEqual(
        new Error(WALLET_ERRORS.INVALID_PRIVATE_KEY)
      )
    })
  })

  describe('execute|contract', () => {
    it('should throw contract error if ethers contract API throws', async () => {
      jest
        .spyOn<any, any>(ethers.providers, 'JsonRpcProvider')
        .mockReturnValue(providerMock)

      jest.spyOn<any, any>(ethers, 'Wallet').mockReturnValue(walletMock)

      jest.spyOn<any, any>(ethers, 'Contract').mockImplementation(() => {
        throw new Error()
      })

      await expect(executeService.execute(validExecuteDto)).rejects.toEqual(
        new Error(CONTRACT_ERRORS.INVALID_CONTRACT)
      )
    })
  })
})
