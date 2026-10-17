const jwt = require('jsonwebtoken');
const { generateToken, sanitizeUser, attachTokenCookie, COOKIE_NAME } = require('../../utils/token');

const fakeUser = {
  _id: { toString: () => '64b000000000000000000001' },
  fullName: 'Ada Lovelace',
  username: 'ada',
  email: 'ada@example.com',
  password: '$2a$10$hashed',
  googleId: 'google-123',
  role: 'admin',
  stats: { problemsSolved: 3 },
  preferences: { theme: 'dark' },
  authProvider: 'local',
};

describe('generateToken', () => {
  it('signs the user id as sub and includes the role', () => {
    const token = generateToken(fakeUser);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded.sub).toBe('64b000000000000000000001');
    expect(decoded.role).toBe('admin');
  });

  it('honours JWT_EXPIRES_IN', () => {
    const decoded = jwt.decode(generateToken(fakeUser));
    expect(decoded.exp - decoded.iat).toBe(60 * 60);
  });

  it('throws when JWT_SECRET is missing', () => {
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => generateToken(fakeUser)).toThrow('Missing JWT_SECRET');
    } finally {
      process.env.JWT_SECRET = secret;
    }
  });
});

describe('sanitizeUser', () => {
  it('never exposes the password hash or googleId', () => {
    const safe = sanitizeUser(fakeUser);

    expect(safe).not.toHaveProperty('password');
    expect(safe).not.toHaveProperty('googleId');
    expect(safe).toMatchObject({
      id: fakeUser._id,
      username: 'ada',
      email: 'ada@example.com',
      role: 'admin',
    });
  });
});

describe('attachTokenCookie', () => {
  it('sets an httpOnly, sameSite=lax cookie that lasts 7 days', () => {
    const res = { cookie: jest.fn() };
    attachTokenCookie(res, 'abc');

    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, 'abc', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it('marks the cookie secure in production', () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = { cookie: jest.fn() };
      attachTokenCookie(res, 'abc');
      expect(res.cookie.mock.calls[0][2].secure).toBe(true);
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});
