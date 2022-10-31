import { ValidationPipe } from '@nestjs/common'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

import { AppModule } from './app.module'
import { AllExceptionsFilter } from './filters/all-exceptions.filter'
import { HttpExceptionFilter } from './filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe())

  const httpAdapter = app.get(HttpAdapterHost)
  // app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter))

  const config = new DocumentBuilder()
    .setTitle('Topos Executor Service')
    .setDescription('The Topos Executor Service API description')
    .setVersion('1.0')
    // .addTag('topos')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  await app.listen(3000)
}
bootstrap()
