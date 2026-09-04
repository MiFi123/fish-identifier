class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL_ERROR", cause } = {}) {
    super(message, { cause });
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

class ProviderConfigurationError extends AppError {
  constructor() {
    super("Die KI-Analyse ist noch nicht konfiguriert.", {
      status: 503,
      code: "PROVIDER_NOT_CONFIGURED",
    });
    this.name = "ProviderConfigurationError";
  }
}

class ProviderRequestError extends AppError {
  constructor(message = "Die KI-Analyse ist momentan nicht verfügbar.", options = {}) {
    super(message, { status: 502, code: "PROVIDER_REQUEST_FAILED", ...options });
    this.name = "ProviderRequestError";
  }
}

module.exports = { AppError, ProviderConfigurationError, ProviderRequestError };
