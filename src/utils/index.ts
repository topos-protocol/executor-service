export function sanitizeURLProtocol(protocol: 'ws' | 'http', endpoint: string) {
  return endpoint.indexOf('localhost') > -1 ||
    endpoint.indexOf('127.0.0.1') > -1
    ? `${protocol}://${endpoint}`
    : `${protocol}s://${endpoint}`
}
