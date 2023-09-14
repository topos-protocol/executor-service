import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger'

import { ExecuteDto } from './execute.dto'
import { ExecuteServiceV1 } from './execute.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller({ version: '1' })
export class ExecuteControllerV1 {
  constructor(private executeService: ExecuteServiceV1) {}

  @ApiTags('execute')
  @Post('execute')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async executeV1(
    @Body() executeDto: ExecuteDto,
    @Headers('traceparent') traceparent?: string
  ) {
    return this.executeService
      .execute(executeDto, { traceparent })
      .catch((error) => {
        throw new BadRequestException(error.message)
      })
  }

  @ApiTags('job')
  @Get('job/:jobId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'jobId' })
  async getJob(@Param('jobId') jobId: string) {
    return this.executeService.getJobById(jobId)
  }

  @ApiTags('job')
  @Sse('job/subscribe/:jobId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'jobId' })
  async subscribeToJob(
    @Param('jobId') jobId: string,
    @Headers('traceparent') traceparent?: string
  ) {
    return this.executeService.subscribeToJobById(jobId, { traceparent })
  }
}
