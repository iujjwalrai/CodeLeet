const { useTestDb } = require('../helpers/db');
const { createUser } = require('../helpers/factories');
const { generateAvailableUsername } = require('../../utils/username');

useTestDb();

describe('generateAvailableUsername', () => {
  it('derives the username from the full name', async () => {
    await expect(generateAvailableUsername('Ada Lovelace', 'x@example.com')).resolves.toBe('adalovelace');
  });

  it('strips characters other than letters and digits', async () => {
    await expect(generateAvailableUsername("O'Brien-Smith 2nd", 'x@example.com')).resolves.toBe('obriensmith2nd');
  });

  it('falls back to the email handle when the name is too short', async () => {
    await expect(generateAvailableUsername('Al', 'al.turing@example.com')).resolves.toBe('alturing');
  });

  it('falls back to coderNNN when neither name nor email is usable', async () => {
    await expect(generateAvailableUsername('', 'a@example.com')).resolves.toMatch(/^coder\d{1,3}$/);
  });

  it('appends an increasing suffix when the name is taken', async () => {
    await createUser({ username: 'adalovelace' });
    await createUser({ username: 'adalovelace1' });

    await expect(generateAvailableUsername('Ada Lovelace', 'x@example.com')).resolves.toBe('adalovelace2');
  });
});
