import { Test, TestingModule } from '@nestjs/testing'

import { ExecuteController } from './execute.controller'
import { ExecuteDto } from './execute.dto'
import { ExecuteService } from './execute.service'

describe('ExecuteController', () => {
  let app: TestingModule
  let executeController: ExecuteController
  let executeService: ExecuteService

  beforeEach(async () => {
    app = await Test.createTestingModule({
      controllers: [ExecuteController],
    })
      .useMocker((token) => {
        if (token === ExecuteService) {
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

    executeController = app.get(ExecuteController)
    executeService = app.get(ExecuteService)
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

      expect(await executeController.execute(executeDto)).toEqual({})
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

      executeController.execute(executeDto)
      expect(executeService.execute).toHaveBeenCalled()
    })
  })
})
