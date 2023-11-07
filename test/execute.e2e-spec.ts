import * as request from 'supertest'
import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'

import { AppModule } from '../src/app.module'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { ExecuteDto } from '../src/execute/execute.dto'
import { ExecuteServiceV1 } from '../src/execute/execute.service'

const validExecuteDto: ExecuteDto = {
  logIndexes: [],
  messagingContractAddress: '0x3B5aCC9B6e58543512828EFAe26B29B7292c8273',
  receiptTrieRoot: 'receiptTrieRoot',
  receiptTrieMerkleProof: 'receiptTrieMerkleProof',
  subnetId: 'subnetId',
}

describe('Execute with ❌ auth (e2e)', () => {
  let app: INestApplication
  let authGuard = { canActivate: jest.fn().mockReturnValue(false) }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  it('/execute (POST) should return 403 Unauthorized', () => {
    return request(app.getHttpServer()).post('/execute').expect(403)
  })

  it('/job/:id (GET) should return 403 Unauthorized', () => {
    return request(app.getHttpServer()).get('/job/1').expect(403)
  })

  it('/job/subscribe/:id (GET) should return 403 Unauthorized', () => {
    return request(app.getHttpServer()).get('/job/subscribe/1').expect(403)
  })
})

describe('Execute with ✅ auth (e2e)', () => {
  let app: INestApplication
  let authGuard = { canActivate: jest.fn().mockReturnValue(true) }
  let executeServiceV1 = { execute: jest.fn().mockResolvedValue({}) }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ExecuteServiceV1)
      .useValue(executeServiceV1)
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())
    await app.init()
  })

  it('/execute (POST) should return 201 Created with valid dto', () => {
    return request(app.getHttpServer())
      .post('/execute')
      .send(validExecuteDto)
      .expect(201)
      .expect({})
  })

  it('/execute (POST) should reject with no body', () => {
    return request(app.getHttpServer()).post('/execute').send().expect(400)
  })

  it('/execute (POST) should reject with invalid dto (invalid messagingContractAddress)', () => {
    const invalidExecuteDto = {
      ...validExecuteDto,
      messagingContractAddress: 'invalid',
    }
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: ['messagingContractAddress must be an Ethereum address'],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (missing messagingContractAddress)', () => {
    const { messagingContractAddress, ...invalidExecuteDto } = validExecuteDto
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: [
          'messagingContractAddress must be an Ethereum address',
          'messagingContractAddress should not be empty',
        ],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (invalid logIndexes)', () => {
    const invalidExecuteDto = {
      ...validExecuteDto,
      logIndexes: ['invalid'],
    }
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: [
          'each value in logIndexes must be a number conforming to the specified constraints',
        ],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (missing logIndexes)', () => {
    const { logIndexes, ...invalidExecuteDto } = validExecuteDto
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: [
          'each value in logIndexes must be a number conforming to the specified constraints',
          'logIndexes should not be empty',
        ],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (invalid subnetId)', () => {
    const invalidExecuteDto = {
      ...validExecuteDto,
      subnetId: 1,
    }
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: ['subnetId must be a string'],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (missing subnetId)', () => {
    const { subnetId, ...invalidExecuteDto } = validExecuteDto
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: ['subnetId must be a string', 'subnetId should not be empty'],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (invalid receiptTrieRoot)', () => {
    const invalidExecuteDto = {
      ...validExecuteDto,
      receiptTrieRoot: 1,
    }
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: ['receiptTrieRoot must be a string'],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (missing receiptTrieRoot)', () => {
    const { receiptTrieRoot, ...invalidExecuteDto } = validExecuteDto
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: [
          'receiptTrieRoot must be a string',
          'receiptTrieRoot should not be empty',
        ],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (invalid receiptTrieMerkleProof)', () => {
    const invalidExecuteDto = {
      ...validExecuteDto,
      receiptTrieMerkleProof: 1,
    }
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: ['receiptTrieMerkleProof must be a string'],
        error: 'Bad Request',
      })
  })

  it('/execute (POST) should reject with invalid dto (missing receiptTrieMerkleProof)', () => {
    const { receiptTrieMerkleProof, ...invalidExecuteDto } = validExecuteDto
    return request(app.getHttpServer())
      .post('/execute')
      .send(invalidExecuteDto)
      .expect({
        statusCode: 400,
        message: [
          'receiptTrieMerkleProof must be a string',
          'receiptTrieMerkleProof should not be empty',
        ],
        error: 'Bad Request',
      })
  })
})
