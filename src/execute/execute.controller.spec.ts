import { Test, TestingModule } from '@nestjs/testing'

import { ExecuteControllerV1 } from './execute.controller'
import { ExecuteDto } from './execute.dto'
import { QUEUE_ERRORS } from './execute.errors'
import { ExecuteServiceV1 } from './execute.service'
import { Observable } from 'rxjs'

const validExecuteDto: ExecuteDto = {
  logIndexes: [],
  messagingContractAddress: '',
  receiptTrieRoot: '',
  receiptTrieMerkleProof: '',
  subnetId: '',
}

describe('ExecuteController', () => {
  let app: TestingModule
  let executeController: ExecuteControllerV1
  let executeService: ExecuteServiceV1

  beforeEach(async () => {
    app = await Test.createTestingModule({
      controllers: [ExecuteControllerV1],
    })
      .useMocker((token) => {
        if (token === ExecuteServiceV1) {
          return {
            execute: jest.fn().mockResolvedValue({}),
            getJobById: jest.fn().mockResolvedValue({}),
            subscribeToJobById: jest.fn().mockResolvedValue({}),
          }
        }
      })
      .compile()

    executeController = app.get(ExecuteControllerV1)
    executeService = app.get(ExecuteServiceV1)
  })

  describe('executeV1', () => {
    it('should complete', async () => {
      expect(await executeController.executeV1(validExecuteDto)).toEqual({})
    })

    it('should call executeService.execute', async () => {
      await executeController.executeV1(validExecuteDto)
      expect(executeService.execute).toHaveBeenCalled()
    })
  })

  describe('getJob', () => {
    it('should call executeService.getJobById', async () => {
      await executeController.getJob('')
      expect(executeService.getJobById).toHaveBeenCalledWith('')
    })

    it('should return expected job', async () => {
      const job = await executeController.getJob('')
      expect(job).toStrictEqual({})
    })

    it("should reject error if job doesn't exist", async () => {
      jest
        .spyOn(executeService, 'getJobById')
        .mockRejectedValueOnce(new Error(QUEUE_ERRORS.JOB_NOT_FOUND))

      expect(executeController.getJob('')).rejects.toEqual(
        new Error(QUEUE_ERRORS.JOB_NOT_FOUND)
      )
    })
  })

  describe('subscribeToJob', () => {
    it('should call executeService.subscribeToJobById', async () => {
      await executeController.subscribeToJob('')
      expect(executeService.subscribeToJobById).toHaveBeenCalledWith('')
    })

    it("should reject error if job doesn't exist", async () => {
      jest.spyOn(executeService, 'subscribeToJobById').mockImplementationOnce(
        () =>
          new Observable((subscriber) => {
            subscriber.error()
          })
      )

      const observable = await executeController.subscribeToJob('')
      expect.assertions(1)
      observable.subscribe({
        error: (error) => {
          expect(error).toBeUndefined()
        },
      })
    })
  })
})
