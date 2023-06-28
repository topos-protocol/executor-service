import { BullModule, getQueueToken } from '@nestjs/bull'
import { Test, TestingModule } from '@nestjs/testing'

import { ExecuteDto } from './execute.dto'
import { ExecuteServiceV1 } from './execute.service'
import { ConfigService } from '@nestjs/config'

const validExecuteDto: ExecuteDto = {
  indexOfDataInTxRaw: 4,
  messagingContractAddress: '',
  subnetId: '',
  txRaw: '',
  txTrieRoot: '',
  txTrieMerkleProof: '',
}

const VALID_PRIVATE_KEY =
  '0xc6cbd7d76bc5baca530c875663711b947efa6a86a900a9e8645ce32e5821484e'

const executeQueueMock = {
  add: jest.fn().mockReturnValue({ id: '', timestamp: 0 }),
  client: { status: 'ready' },
}

describe('ExecuteService', () => {
  let app: TestingModule
  let executeService: ExecuteServiceV1

  beforeEach(async () => {
    app = await Test.createTestingModule({
      imports: [BullModule.registerQueue({ name: 'execute' })],
      providers: [ExecuteServiceV1],
    })
      .useMocker((token) => {
        if (token === ConfigService) {
          return {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'PRIVATE_KEY':
                  return VALID_PRIVATE_KEY
              }
            }),
          }
        }
      })
      .overrideProvider(getQueueToken('execute'))
      .useValue(executeQueueMock)
      .compile()

    executeService = app.get(ExecuteServiceV1)
  })

  describe('execute', () => {
    it('should call queue.add', () => {
      executeService.execute(validExecuteDto)
      expect(executeQueueMock.add).toHaveBeenCalledWith(
        'execute',
        validExecuteDto
      )
    })
  })
})
