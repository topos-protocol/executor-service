export enum PROVIDER_ERRORS {
  INVALID_ENDPOINT = 'Provider // Invalid endpoint!',
}

export enum WALLET_ERRORS {
  INVALID_PRIVATE_KEY = 'Wallet // Invalid private key!',
}

export enum QUEUE_ERRORS {
  JOB_NOT_FOUND = 'Queue // A job with the provided id could not be found!',
  REDIS_NOT_AVAILABLE = 'Queue // Could not connect to Redis!',
}

export enum JOB_ERRORS {
  MISSING_CERTIFICATE = 'Job // Could not find the related certificate!',
}
