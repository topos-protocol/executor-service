import { BullModule, getQueueToken } from '@nestjs/bull'
import { Test, TestingModule } from '@nestjs/testing'
import { Job } from 'bull'

import { ExecuteDto } from './execute.dto'
import { ExecuteServiceV1 } from './execute.service'
import { ConfigService } from '@nestjs/config'
import { first, firstValueFrom, lastValueFrom } from 'rxjs'

const validExecuteDto: ExecuteDto = {
  logIndexes: [],
  messagingContractAddress: '',
  receiptTrieRoot: '',
  receiptTrieMerkleProof: '',
  subnetId: '',
}

const VALID_PRIVATE_KEY =
  '0xc6cbd7d76bc5baca530c875663711b947efa6a86a900a9e8645ce32e5821484e'

const executeQueueMock = {
  add: jest.fn().mockReturnValue({ id: '', timestamp: 0 }),
  getJob: jest.fn().mockImplementation((jobId: string) =>
    Promise.resolve({
      id: jobId,
      failedReason: 'errorMock',
      finished: jest.fn().mockResolvedValue({}),
    })
  ),
  on: jest
    .fn()
    .mockImplementation(
      (
        event: 'progress',
        callback: (job: Partial<Job>, progress: string) => void
      ) => {
        const fakeJob = { id: '1' }
        callback(fakeJob, '')
      }
    ),
  removeListener: jest.fn(),
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

  describe('getJobById', () => {
    it('should return job', async () => {
      const jobId = '1'
      const job = await executeService.getJobById(jobId)

      expect(executeQueueMock.getJob).toHaveBeenCalledWith(jobId)
      expect(job.id).toBe(jobId)
    })
  })

  describe('subscribeToJobById', () => {
    it('should retrieve the correct job', () => {
      const jobId = '1'
      executeService
        .subscribeToJobById(jobId)
        .pipe(first())
        .subscribe(() => {
          expect(executeQueueMock.getJob).toHaveBeenCalledWith(jobId)
          expect(executeQueueMock.on).toHaveBeenCalled()
        })
    })

    it('should first next some progress', async () => {
      const jobId = '1'
      await expect(
        firstValueFrom(executeService.subscribeToJobById(jobId))
      ).resolves.toStrictEqual({
        data: { payload: '', type: 'progress' },
      })
    })

    it('should then complete', async () => {
      const jobId = '1'
      await expect(
        lastValueFrom(executeService.subscribeToJobById(jobId))
      ).resolves.toStrictEqual({
        data: { payload: {}, type: 'completed' },
      })
    })

    it('should fail if job finishes with rejection', async () => {
      const jobId = '1'

      jest.spyOn(executeQueueMock, 'getJob').mockImplementationOnce(
        (jobId: string) =>
          new Promise((resolve) => {
            const job: Partial<Job> = {
              id: jobId,
              failedReason: 'errorMock',
              finished: jest.fn().mockRejectedValueOnce('errorMock'),
            }
            resolve(job)
          })
      )

      await expect(
        lastValueFrom(executeService.subscribeToJobById(jobId))
      ).rejects.toStrictEqual('errorMock')
    })
  })
})
