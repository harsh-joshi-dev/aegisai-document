/**
 * PII Redaction and Sanitization
 * Remove sensitive information before analysis for privacy
 */
import { PresidioAnalyzer, PresidioAnonymizer } from '@microsoft/presidio-js';

// Simple PII detection patterns (fallback if Presidio not available)
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

export interface RedactionResult {
  sanitizedText: string;
  redactions: Array<{
    type: string;
    original: string;
    replacement: string;
    position: { start: number; end: number };
  }>;
  redactionCount: number;
}

/**
 * Redact PII from text
 */
export async function redactPII(
  text: string,
  options: {
    redactEmail?: boolean;
    redactPhone?: boolean;
    redactSSN?: boolean;
    redactCreditCard?: boolean;
    redactIP?: boolean;
    customPatterns?: Array<{ name: string; pattern: RegExp; replacement: string }>;
  } = {}
): Promise<RedactionResult> {
  const {
    redactEmail = true,
    redactPhone = true,
    redactSSN = true,
    redactCreditCard = true,
    redactIP = true,
    customPatterns = [],
  } = options;

  let sanitizedText = text;
  const redactions: RedactionResult['redactions'] = [];
  let offset = 0;

  // Redact emails
  if (redactEmail) {
    const matches = [...text.matchAll(PII_PATTERNS.email)];
    for (const match of matches) {
      const replacement = '[EMAIL_REDACTED]';
      sanitizedText = sanitizedText.replace(match[0], replacement);
      redactions.push({
        type: 'email',
        original: match[0],
        replacement,
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  // Redact phone numbers
  if (redactPhone) {
    const matches = [...text.matchAll(PII_PATTERNS.phone)];
    for (const match of matches) {
      const replacement = '[PHONE_REDACTED]';
      sanitizedText = sanitizedText.replace(match[0], replacement);
      redactions.push({
        type: 'phone',
        original: match[0],
        replacement,
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  // Redact SSN
  if (redactSSN) {
    const matches = [...text.matchAll(PII_PATTERNS.ssn)];
    for (const match of matches) {
      const replacement = '[SSN_REDACTED]';
      sanitizedText = sanitizedText.replace(match[0], replacement);
      redactions.push({
        type: 'ssn',
        original: match[0],
        replacement,
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  // Redact credit cards
  if (redactCreditCard) {
    const matches = [...text.matchAll(PII_PATTERNS.creditCard)];
    for (const match of matches) {
      const replacement = '[CARD_REDACTED]';
      sanitizedText = sanitizedText.replace(match[0], replacement);
      redactions.push({
        type: 'credit_card',
        original: match[0],
        replacement,
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  // Redact IP addresses
  if (redactIP) {
    const matches = [...text.matchAll(PII_PATTERNS.ipAddress)];
    for (const match of matches) {
      const replacement = '[IP_REDACTED]';
      sanitizedText = sanitizedText.replace(match[0], replacement);
      redactions.push({
        type: 'ip_address',
        original: match[0],
        replacement,
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  // Apply custom patterns
  for (const customPattern of customPatterns) {
    const matches = [...sanitizedText.matchAll(customPattern.pattern)];
    for (const match of matches) {
      sanitizedText = sanitizedText.replace(match[0], customPattern.replacement);
      redactions.push({
        type: customPattern.name,
        original: match[0],
        replacement: customPattern.replacement,
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  return {
    sanitizedText,
    redactions,
    redactionCount: redactions.length,
  };
}

/**
 * Sanitize text before analysis (removes PII)
 */
export async function sanitizeForAnalysis(text: string): Promise<string> {
  const result = await redactPII(text, {
    redactEmail: true,
    redactPhone: true,
    redactSSN: true,
    redactCreditCard: true,
    redactIP: true,
  });
  return result.sanitizedText;
}

/**
 * Get redaction summary
 */
export function getRedactionSummary(result: RedactionResult): {
  totalRedactions: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  
  result.redactions.forEach(redaction => {
    byType[redaction.type] = (byType[redaction.type] || 0) + 1;
  });

  return {
    totalRedactions: result.redactionCount,
    byType,
  };
}
