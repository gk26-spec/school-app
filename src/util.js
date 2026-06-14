// Wrap async route handlers so rejected promises go to the error middleware
// instead of crashing the process.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
