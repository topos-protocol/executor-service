import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { ApmModule } from '../apm/apm.module'
import { AuthModule } from '../auth/auth.module'
import { ExecuteControllerV1 } from './execute.controller'
import { ExecutionProcessorV1 } from './execute.processor'
import { ExecuteServiceV1 } from './execute.service'

@Module({
  controllers: [ExecuteControllerV1],
  imports: [BullModule.registerQueue({ name: 'execute' }), ApmModule, AuthModule],
  providers: [ExecutionProcessorV1, ExecuteServiceV1, ConfigService],
})
export class ExecuteModuleV1 {}
