import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ExecuteControllerV1 } from './execute.controller'
import { ExecutionProcessorV1 } from './execute.processor'
import { ExecuteServiceV1 } from './execute.service'

@Module({
  controllers: [ExecuteControllerV1],
  imports: [BullModule.registerQueue({ name: 'execute' }), AuthModule],
  providers: [ExecutionProcessorV1, ExecuteServiceV1],
})
export class ExecuteModuleV1 {}
