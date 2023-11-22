import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'
import { utilities, WinstonModule } from 'nest-winston'
import { format as winstonFormat, transports } from 'winston'
import LokiTransport from 'winston-loki'

import { ExecuteModuleV1 } from './execute/execute.module'
import { TelemetryModule } from './telemetry/telemetry.module'

@Module({
  imports: [
    TelemetryModule,
    ConfigModule.forRoot({ isGlobal: true }),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const format = winstonFormat.combine(
          winstonFormat.timestamp(),
          utilities.format.nestLike('Executor Service')
        )
        return {
          level: configService.get('LOG_LEVEL') || 'info',
          transports: [
            new transports.Console({
              format,
            }),
            new LokiTransport({
              format,
              host: configService.getOrThrow('LOKI_HOST'),
              labels: {
                service: configService.getOrThrow('OTEL_SERVICE_NAME'),
              },
            }),
          ],
        }
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.getOrThrow('REDIS_HOST'),
          port: configService.getOrThrow('REDIS_PORT'),
        },
      }),
    }),
    ExecuteModuleV1,
  ],
})
export class AppModule {}
