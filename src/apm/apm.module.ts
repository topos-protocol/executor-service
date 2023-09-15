import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { ApmService } from './apm.service'

@Module({
  imports: [ConfigModule],
  exports: [ApmService],
  providers: [ApmService],
})
export class ApmModule {}
