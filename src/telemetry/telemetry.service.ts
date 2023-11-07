import { Injectable } from '@nestjs/common'

// Uncomment to get otlp logs
// import {
//   diag,
//   DiagConsoleLogger,
//   DiagLogLevel,
//   metrics,
// } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

const OTEL_EXPORTER_OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'

@Injectable()
export class TelemetryService {
  constructor() {
    // Uncomment to get otlp logs
    // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)

    const otelSDK = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
        }),
      }),
      instrumentations: [],
    })

    otelSDK.start()

    // gracefully shut down the SDK on process exit
    process.on('SIGTERM', () => {
      otelSDK
        .shutdown()
        .then(
          () => console.log('SDK shut down successfully'),
          (err) => console.log('Error shutting down SDK', err)
        )
        .finally(() => process.exit(0))
    })
  }
}
