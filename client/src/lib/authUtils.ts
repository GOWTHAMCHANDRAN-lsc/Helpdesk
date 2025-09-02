export function isUnauthorizedError(error: Error): boolean {
  // Treat any 401 status error as unauthorized regardless of message body
  return /^401:/.test(error.message);
}