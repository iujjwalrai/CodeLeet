const { useTestDb } = require('../helpers/db');
const { createUser } = require('../helpers/factories');
const User = require('../../models/User');

useTestDb();

describe('User model', () => {
  it('hashes the password on save', async () => {
    const user = await createUser({ password: 'plaintext' });
    const stored = await User.findById(user._id);

    expect(stored.password).not.toBe('plaintext');
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it('does not re-hash the password when other fields change', async () => {
    const user = await createUser({ password: 'plaintext' });
    const hash = user.password;

    user.bio = 'hello';
    await user.save();

    expect(user.password).toBe(hash);
  });

  it('comparePassword accepts the right password and rejects others', async () => {
    const user = await createUser({ password: 'correct-horse' });

    await expect(user.comparePassword('correct-horse')).resolves.toBe(true);
    await expect(user.comparePassword('wrong')).resolves.toBe(false);
  });

  it('comparePassword is false for accounts without a password (Google users)', async () => {
    const user = await createUser({ password: undefined, authProvider: 'google' });
    expect(user.comparePassword('anything')).toBe(false);
  });

  it('lowercases email and username and applies defaults', async () => {
    const user = await createUser({ email: 'MiXeD@Example.com', username: 'MiXeD' });

    expect(user.email).toBe('mixed@example.com');
    expect(user.username).toBe('mixed');
    expect(user.role).toBe('user');
    expect(user.stats.totalSubmissions).toBe(0);
    expect(user.preferences.theme).toBe('dark');
  });

  it('rejects duplicate emails', async () => {
    await createUser({ email: 'dup@example.com' });
    await expect(createUser({ email: 'dup@example.com' })).rejects.toThrow(/duplicate key/);
  });
});
