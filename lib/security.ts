// lib/security.ts
// Security routines for detecting prompt injection attempts and sanitizing user-provided texts.

const INJECTION_PATTERNS = [
  /ignore.*instructions/i,
  /override.*instructions/i,
  /bypass.*instructions/i,
  /you are now/i,
  /new persona/i,
  /forget (everything|all|previous|past)/i,
  /system prompt/i,
  /reveal (all|other|user|memories)/i,
  /act as/i,
  /jailbreak/i,
  /DAN/i,
];

const SENSITIVE_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // API keys
  { pattern: /sk-ant-[a-zA-Z0-9\-_]{20,}/g, replacement: '[ANTHROPIC_KEY_REDACTED]' },
  { pattern: /sk-[a-zA-Z0-9]{32,}/g, replacement: '[OPENAI_KEY_REDACTED]' },
  { pattern: /gsk_[a-zA-Z0-9]{32,}/g, replacement: '[GROQ_KEY_REDACTED]' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[GITHUB_TOKEN_REDACTED]' },
  { pattern: /xox[baprs]-[a-zA-Z0-9\-]{10,}/g, replacement: '[SLACK_TOKEN_REDACTED]' },
  
  // passwords mentioned directly
  { pattern: /password[\s]*[:=][\s]*\S+/gi, replacement: 'password: [REDACTED]' },
  { pattern: /passwd[\s]*[:=][\s]*\S+/gi, replacement: 'passwd: [REDACTED]' },
  { pattern: /secret[\s]*[:=][\s]*\S+/gi, replacement: 'secret: [REDACTED]' },
  
  // credit cards
  { pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  
  // Indian phone numbers
  { pattern: /\b[6-9]\d{9}\b/g, replacement: '[PHONE_REDACTED]' },
  
  // generic secrets and tokens
  { pattern: /Bearer\s+[a-zA-Z0-9\-_\.]{20,}/g, replacement: 'Bearer [TOKEN_REDACTED]' },
  { pattern: /token[\s]*[:=][\s]*[a-zA-Z0-9\-_]{16,}/gi, replacement: 'token: [REDACTED]' },
  
  // database connection strings
  { pattern: /postgresql:\/\/[^\s]+/gi, replacement: '[DB_URL_REDACTED]' },
  { pattern: /mongodb(\+srv)?:\/\/[^\s]+/gi, replacement: '[DB_URL_REDACTED]' },
  
  // AWS keys
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[AWS_KEY_REDACTED]' },
];

/**
 * Checks if a given text contains typical prompt injection signatures.
 */
export function detectInjection(text: string): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

export interface RedactionResult {
  redacted: string;
  wasRedacted: boolean;
  redactedTypes: string[];
}

/**
 * Redacts any sensitive credentials or personal financial identifiers from a string.
 */
export function redactSensitiveData(text: string): RedactionResult {
  if (!text) {
    return { redacted: text, wasRedacted: false, redactedTypes: [] };
  }

  let result = text;
  const redactedTypes: string[] = [];

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    if (pattern.test(result)) {
      redactedTypes.push(replacement);
      result = result.replace(pattern, replacement);
    }
    // Reset regex lastIndex after test
    pattern.lastIndex = 0;
  }

  return {
    redacted: result,
    wasRedacted: redactedTypes.length > 0,
    redactedTypes,
  };
}
