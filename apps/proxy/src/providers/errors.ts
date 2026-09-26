export class ProviderNotConfiguredError extends Error {
  constructor(readonly provider: string) {
    super(`${provider} is not configured`);
  }
}

export class ProviderHttpError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
