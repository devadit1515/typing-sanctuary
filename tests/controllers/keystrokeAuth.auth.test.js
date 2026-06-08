describe('keystrokeAuthController reads req.userId (JWT), not req.session.userId', () => {
  test('source code contains no req.session.userId references', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../controllers/keystrokeAuthController.js'),
      'utf8'
    );
    expect(src.includes('req.session.userId')).toBe(false);
    expect(src.includes('req.userId')).toBe(true);
  });
});
