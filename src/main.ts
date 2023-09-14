import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import * as ElasticAPM from 'elastic-apm-node'

import { AppModule } from './app.module'
import { ExecuteModuleV1 } from './execute/execute.module'

export const SERVICE_NAME = process.env.TRACING_SERVICE_NAME || 'executor-service'
export const SERVICE_VERSION = process.env.TRACING_SERVICE_VERSION || 'unknown'
export const ELASTIC_APM_ENDPOINT = process.env.ELASTIC_APM_ENDPOINT || ''
export const ELASTIC_APM_TOKEN = process.env.ELASTIC_APM_TOKEN || ''

export const apm = ElasticAPM.start({
  serviceName: SERVICE_NAME,
  secretToken: ELASTIC_APM_TOKEN,
  serverUrl: ELASTIC_APM_ENDPOINT,
  environment: 'local',
  opentelemetryBridgeEnabled: true,
  captureBody: 'all',
})

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableVersioning()
  app.useGlobalPipes(new ValidationPipe())
  app.enableCors()

  const config = new DocumentBuilder()
    .setTitle('Topos Executor Service')
    .setDescription('The Topos Executor Service API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config, {
    include: [ExecuteModuleV1],
  })
  SwaggerModule.setup('api/v1', app, document)

  await app.listen(3000)
}
bootstrap()
