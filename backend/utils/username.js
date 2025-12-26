const User = require('../models/User');

const sanitize = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const deriveBase = (fullName, email) => {
  const fromName = sanitize(fullName || '');
  if (fromName.length >= 3) {
    return fromName;
  }

  if (email) {
    const handle = sanitize(email.split('@')[0]);
    if (handle.length >= 3) {
      return handle;
    }
  }

  return `coder${Math.floor(Math.random() * 1000)}`;
};

async function generateAvailableUsername(fullName, email) {
  const base = deriveBase(fullName, email);
  let candidate = base;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }

  return candidate;
}

module.exports = {
  generateAvailableUsername,
};

