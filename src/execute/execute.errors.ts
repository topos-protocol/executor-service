export enum QUEUE_ERRORS {
  JOB_NOT_FOUND = 'Queue // A job with the provided id could not be found!',
  REDIS_NOT_AVAILABLE = 'Queue // Could not connect to Redis!',
}

export enum ExecuteProcessorError {
  PROVIDER_INVALID_ENDPOINT = 'PROVIDER_INVALID_ENDPOINT',
  CONTRACT_INVALID_ADDRESS = 'CONTRACT_INVALID_ADDRESS',
  CONTRACT_INVALID_NO_CODE = 'CONTRACT_INVALID_NO_CODE',
  WALLET_INVALID_PRIVATE_KEY = 'WALLET_INVALID_PRIVATE_KEY',
  CERTIFICATE_NOT_FOUND = 'CERTIFICATE_NOT_FOUND',
  EXECUTE_TRANSACTION_FAILED_INIT = 'EXECUTE_TRANSACTION_FAILED_INIT',
  EXECUTE_TRANSACTION_REVERT = 'EXECUTE_TRANSACTION_REVERT',
}

export enum ExecuteProcessorErrorMessage {
  PROVIDER_INVALID_ENDPOINT = 'Invalid subnet endpoint',
  CONTRACT_INVALID_ADDRESS = 'Invalid messaging contract address',
  CONTRACT_INVALID_NO_CODE = 'Invalid messaging contract (no code at address)',
  WALLET_INVALID_PRIVATE_KEY = 'Invalid private key',
  CERTIFICATE_NOT_FOUND = 'A certificate with the provided receipt trie root could not be found',
  EXECUTE_TRANSACTION_FAILED_INIT = 'The execute transaction could not be created',
}

export class ExecuteError extends Error {
  constructor(type: ExecuteProcessorError, message?: string) {
    const _message = JSON.stringify({
      type,
      message: message || ExecuteProcessorErrorMessage[type],
    })
    super(_message)
    this.name = 'ExecuteError'
  }
}

export interface ExecuteTransactionError {
  decoded?: boolean
  data: string
}
