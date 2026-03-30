process.env.JWT_SECRET = 'test-secret-key';

const { signToken, verifyToken, generateRefreshToken, JWT_SECRET } = require('../../src/helpers/jwt');

describe('jwt helpers', () => {
  describe('signToken', () => {
    it('returns a string', () => {
      const token = signToken({ id: 1 });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('encodes payload correctly', () => {
      const token = signToken({ id: 42, role: 'user' });
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(42);
      expect(decoded.role).toBe('user');
    });

    it('respects custom expiration', () => {
      const token = signToken({ id: 1 }, '1s');
      const decoded = verifyToken(token);
      expect(decoded.exp - decoded.iat).toBe(1);
    });
  });

  describe('verifyToken', () => {
    it('round-trips with signToken', () => {
      const payload = { id: 99, email: 'test@example.com' };
      const token = signToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(99);
      expect(decoded.email).toBe('test@example.com');
    });

    it('throws on invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow();
    });

    it('throws on expired token', () => {
      // Create a token that expired 1 hour ago
      const jwt = require('jsonwebtoken');
      const expired = jwt.sign({ id: 1 }, JWT_SECRET, { expiresIn: '-1h' });
      expect(() => verifyToken(expired)).toThrow(/expired/i);
    });
  });

  describe('generateRefreshToken', () => {
    it('returns 64-char hex string', () => {
      const token = generateRefreshToken();
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it('generates unique tokens', () => {
      const a = generateRefreshToken();
      const b = generateRefreshToken();
      expect(a).not.toBe(b);
    });
  });
});
