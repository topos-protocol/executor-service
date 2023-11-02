import { Module } from '@nestjs/common'

import { TelemetryService } from './telemetry.service'

@Module({
  exports: [TelemetryService],
  providers: [TelemetryService],
})
export class TelemetryModule {}
