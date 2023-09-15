import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as ElasticAPM from 'elastic-apm-node'

export const SERVICE_NAME =
  process.env.TRACING_SERVICE_NAME || 'executor-service'
export const SERVICE_VERSION = process.env.TRACING_SERVICE_VERSION || 'unknown'
export const ELASTIC_APM_ENDPOINT = process.env.ELASTIC_APM_ENDPOINT || ''
export const ELASTIC_APM_TOKEN = process.env.ELASTIC_APM_TOKEN || ''

@Injectable()
export class ApmService {
  private _apm: ElasticAPM.Agent

  constructor(private configService: ConfigService) {
    this._apm = ElasticAPM.start({
      serviceName:
        this.configService.get('TRACING_SERVICE_NAME') || 'executor-service',
      secretToken: this.configService.get('ELASTIC_APM_TOKEN') || '',
      serverUrl: this.configService.get('ELASTIC_APM_ENDPOINT') || '',
      environment: this.configService.get('SERVICE_VERSION') || 'unknown',
      opentelemetryBridgeEnabled: true,
      captureBody: 'all',
    })
  }

  startTransaction(name: string, traceparent?: string) {
    return this._apm.startTransaction(
      name,
      traceparent
        ? {
            childOf: traceparent,
          }
        : undefined
    )
  }

  captureError(error: string) {
    this._apm.captureError(error)
  }
}
