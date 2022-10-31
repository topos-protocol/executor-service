import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { ExecuteController } from './execute.controller'
import { ExecutionProcessor } from './execute.processor'
import { ExecuteService } from './execute.service'

@Module({
  controllers: [ExecuteController],
  imports: [ConfigModule, BullModule.registerQueue({ name: 'execute' })],
  providers: [ExecutionProcessor, ExecuteService],
})
export class ExecuteModule {}
