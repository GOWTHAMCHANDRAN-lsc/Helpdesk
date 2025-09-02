// Middleware to set secure HTTP headers
import helmet from 'helmet';

export default helmet({
  contentSecurityPolicy: false, // Set to true and configure for strict CSP in production
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  xssFilter: true,
  noSniff: true,
  hidePoweredBy: true,
});
