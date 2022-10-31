import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiParam } from '@nestjs/swagger'

import { ExecuteDto } from './execute.dto'
import { ExecuteService } from './execute.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller()
export class ExecuteController {
  constructor(private executeService: ExecuteService) {}

  @Post('execute')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async execute(@Body() executeDto: ExecuteDto) {
    return this.executeService.execute(executeDto)
  }

  @Get('job/:jobId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'jobId' })
  async getJob(@Param('jobId') jobId: string) {
    return this.executeService.getJobById(jobId)
  }
}
