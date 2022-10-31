import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'

import { AuthModule } from './auth/auth.module'
import { ExecuteModule } from './execute/execute.module'

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    ExecuteModule,
  ],
})
export class AppModule {}
