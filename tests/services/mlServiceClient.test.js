const { isEnabled, embed } = require('../../services/mlServiceClient');

describe('mlServiceClient', () => {
  test('disabled by default when ML_SERVICE_URL unset', () => {
    delete process.env.ML_SERVICE_URL;
    expect(isEnabled()).toBe(false);
  });

  test('enabled when ML_SERVICE_URL set', () => {
    process.env.ML_SERVICE_URL = 'http://localhost:8000';
    expect(isEnabled()).toBe(true);
    delete process.env.ML_SERVICE_URL;
  });

  test('embed throws clear error when disabled', async () => {
    delete process.env.ML_SERVICE_URL;
    await expect(embed([], 'stub-0')).rejects.toThrow(/not configured/i);
  });
});
