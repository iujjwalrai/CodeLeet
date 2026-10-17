// app.js calls connectDB() on import. Tests connect mongoose themselves via
// tests/helpers/db.js, so this is a no-op.
module.exports = jest.fn(async () => {});
