import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'

import { AppModule } from './app.module'
import { ExecuteModuleV1 } from './execute/execute.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))
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
