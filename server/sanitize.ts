// Utility to sanitize user input (basic XSS prevention)
import xss from 'xss';

export function sanitizeInput(input: string): string {
  return xss(input, {
    whiteList: {}, // Remove all tags
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script'],
  });
}
