import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { ExecuteControllerV1 } from './execute.controller'
import { ExecutionProcessorV1 } from './execute.processor'
import { ExecuteServiceV1 } from './execute.service'

@Module({
  controllers: [ExecuteControllerV1],
  imports: [ConfigModule, BullModule.registerQueue({ name: 'execute' })],
  providers: [ExecutionProcessorV1, ExecuteServiceV1],
})
export class ExecuteModuleV1 {}
