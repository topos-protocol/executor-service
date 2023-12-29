import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import {
  SubnetRegistrator__factory,
  ToposCore__factory,
  ToposMessaging__factory,
} from '@topos-protocol/topos-smart-contracts/typechain-types'
import { Job } from 'bull'
import * as ethers from 'ethers'
import { EventEmitter } from 'stream'

import { ExecuteDto } from './execute.dto'
import { ExecutionProcessorV1 } from './execute.processor'
import { TracingOptions } from './execute.service'

const VALID_PRIVATE_KEY =
  '0xc6cbd7d76bc5baca530c875663711b947efa6a86a900a9e8645ce32e5821484e'
const TOPOS_CORE_PROXY_CONTRACT_ADDRESS =
  '0x1D7b9f9b1FF6cf0A3BEB0F84fA6F8628E540E97F'
const TOPOS_SUBNET_ENDPOINT_WS = 'ws://topos-subnet-endpoint/ws'

const validExecuteJob: Partial<
  Job<ExecuteDto & { tracingOptions: TracingOptions }>
> = {
  data: {
    logIndexes: [],
    messagingContractAddress: '',
    receiptTrieRoot: '',
    receiptTrieMerkleProof: '',
    subnetId: 'id',
    tracingOptions: {
      traceparent: '',
      tracestate: '',
    },
  },
  moveToFailed: jest.fn(),
  progress: jest.fn(),
}

const subnetMock = { endpointWs: 'ws://endpoint/ws' }
const providerMock = Object.assign(new EventEmitter(), {
  getCode: jest.fn().mockResolvedValue('0x123'),
})
const walletMock = {}
const transactionMock = { wait: jest.fn(() => Promise.resolve({})) }
const contractMock = {
  execute: jest.fn().mockResolvedValue(transactionMock),
  networkSubnetId: jest.fn().mockResolvedValue(''),
  subnets: jest.fn().mockResolvedValue(subnetMock),
  receiptRootToCertId: jest.fn().mockResolvedValue(''),
}

describe('ExecuteProcessor', () => {
  let app: TestingModule
  let executeProcessor: ExecutionProcessorV1

  beforeEach(async () => {
    app = await Test.createTestingModule({
      providers: [ExecutionProcessorV1],
    })
      .useMocker((token) => {
        if (token === ConfigService) {
          const configGetterMock = jest
            .fn()
            .mockImplementation((key: string) => {
              switch (key) {
                case 'PRIVATE_KEY':
                  return VALID_PRIVATE_KEY
                case 'TOPOS_CORE_PROXY_CONTRACT_ADDRESS':
                  return TOPOS_CORE_PROXY_CONTRACT_ADDRESS
                case 'TOPOS_SUBNET_ENDPOINT_WS':
                  return TOPOS_SUBNET_ENDPOINT_WS
              }
            })
          return {
            get: configGetterMock,
            getOrThrow: configGetterMock,
          }
        }
      })
      .compile()

    executeProcessor = app.get(ExecutionProcessorV1)
  })

  describe('execute', () => {
    it('should go through if processed job is valid', async () => {
      const ethersProviderMock = jest
        .spyOn<any, any>(ethers, 'getDefaultProvider')
        .mockImplementation(() => providerMock)

      const ethersWalletMock = jest
        .spyOn<any, any>(ethers, 'Wallet')
        .mockReturnValue(walletMock)

      jest
        .spyOn<any, any>(SubnetRegistrator__factory, 'connect')
        .mockReturnValue(contractMock)
      jest
        .spyOn<any, any>(ToposCore__factory, 'connect')
        .mockReturnValue(contractMock)
      jest
        .spyOn<any, any>(ToposMessaging__factory, 'connect')
        .mockReturnValue(contractMock)

      await executeProcessor.execute(
        validExecuteJob as unknown as Job<
          ExecuteDto & { tracingOptions: TracingOptions }
        >
      )

      expect(ethersProviderMock).toHaveBeenCalledWith(TOPOS_SUBNET_ENDPOINT_WS)
      expect(ethersProviderMock).toHaveBeenCalledWith(subnetMock.endpointWs)
      expect(ethersWalletMock).toHaveBeenCalledWith(
        VALID_PRIVATE_KEY,
        providerMock
      )

      expect(contractMock.receiptRootToCertId).toHaveBeenCalled()

      expect(validExecuteJob.progress).toHaveBeenCalledWith(50)

      expect(contractMock.execute).toHaveBeenCalledWith(
        validExecuteJob.data.logIndexes,
        validExecuteJob.data.receiptTrieRoot,
        validExecuteJob.data.receiptTrieMerkleProof,
        {
          gasLimit: 4_000_000,
        }
      )
      expect(validExecuteJob.progress).toHaveBeenCalledWith(100)
    })
  })
})
