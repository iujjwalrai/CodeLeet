// The app logs freely (including on the error paths these tests exercise).
// Keep test output readable; run with DEBUG_TESTS=1 to see the logs.
if (!process.env.DEBUG_TESTS) {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
}
