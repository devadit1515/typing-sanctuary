module.exports = {
  baseUrl: () => process.env.ML_SERVICE_URL || null,
  serviceToken: () => process.env.ML_SERVICE_TOKEN || null,
  timeoutMs: () => parseInt(process.env.ML_SERVICE_TIMEOUT_MS || '4000', 10),
};
