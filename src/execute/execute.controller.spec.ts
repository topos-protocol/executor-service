import { Test, TestingModule } from '@nestjs/testing'

import { ExecuteControllerV1 } from './execute.controller'
import { ExecuteDto } from './execute.dto'
import { ExecuteServiceV1 } from './execute.service'

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
            execute: jest.fn().mockImplementation(
              () =>
                new Promise((resolve) => {
                  resolve({})
                })
            ),
          }
        }
      })
      .compile()

    executeController = app.get(ExecuteControllerV1)
    executeService = app.get(ExecuteServiceV1)
  })

  describe('execute', () => {
    it('should complete', async () => {
      const executeDto: ExecuteDto = {
        certId: '',
        crossSubnetMessage: {
          args: [],
          contractAddress: '',
          id: '',
          method: '',
          receivingSubnetEndpoint: '',
        },
        inclusionProof: new Uint8Array(),
      }

      expect(await executeController.executeV1(executeDto)).toEqual({})
    })

    it('should call executeService.execute', () => {
      const executeDto: ExecuteDto = {
        certId: '',
        crossSubnetMessage: {
          args: [],
          contractAddress: '',
          id: '',
          method: '',
          receivingSubnetEndpoint: '',
        },
        inclusionProof: new Uint8Array(),
      }

      executeController.executeV1(executeDto)
      expect(executeService.execute).toHaveBeenCalled()
    })
  })
})
