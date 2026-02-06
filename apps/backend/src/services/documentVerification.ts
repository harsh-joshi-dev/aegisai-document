import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
    });
  }
  
  return llm;
}

export interface VerificationResult {
  isAuthentic: boolean;
  isAuthorized: boolean;
  fraudScore: number; // 0-100, lower is better
  confidence: number; // 0-100
  status: 'Verified' | 'Suspicious' | 'Fraudulent' | 'Unknown';
  checks: {
    metadata: {
      passed: boolean;
      score: number;
      details: string;
    };
    integrity: {
      passed: boolean;
      score: number;
      details: string;
    };
    signatures: {
      passed: boolean;
      score: number;
      details: string;
    };
    consistency: {
      passed: boolean;
      score: number;
      details: string;
    };
    patterns: {
      passed: boolean;
      score: number;
      details: string;
    };
  };
  warnings: string[];
  recommendations: string[];
}

/**
 * Comprehensive document verification and fraud detection
 */
export async function verifyDocument(
  documentContent: string,
  fileBuffer: Buffer,
  filename: string,
  metadata?: Record<string, any>
): Promise<VerificationResult> {
  const checks = {
    metadata: await checkMetadata(documentContent, metadata),
    integrity: await checkIntegrity(fileBuffer, filename),
    signatures: await checkSignatures(documentContent),
    consistency: await checkConsistency(documentContent),
    patterns: await checkFraudPatterns(documentContent, filename),
  };

  // Calculate overall scores
  const fraudScore = Math.round(
    (checks.metadata.score +
      checks.integrity.score +
      checks.signatures.score +
      checks.consistency.score +
      checks.patterns.score) /
      5
  );

  const confidence = calculateConfidence(checks);
  const isAuthentic = fraudScore < 30 && confidence > 70;
  const isAuthorized = checks.signatures.passed && checks.metadata.passed;

  let status: 'Verified' | 'Suspicious' | 'Fraudulent' | 'Unknown';
  if (fraudScore < 20 && confidence > 80) {
    status = 'Verified';
  } else if (fraudScore < 50 && confidence > 60) {
    status = 'Suspicious';
  } else if (fraudScore >= 50) {
    status = 'Fraudulent';
  } else {
    status = 'Unknown';
  }

  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (!checks.metadata.passed) {
    warnings.push('Document metadata appears incomplete or suspicious');
    recommendations.push('Verify document source and creation date');
  }

  if (!checks.integrity.passed) {
    warnings.push('Document integrity check failed');
    recommendations.push('Document may have been tampered with - verify with original source');
  }

  if (!checks.signatures.passed) {
    warnings.push('No valid signatures or authorization found');
    recommendations.push('Request signed copy from authorized party');
  }

  if (!checks.consistency.passed) {
    warnings.push('Inconsistencies detected in document content');
    recommendations.push('Review document manually for discrepancies');
  }

  if (!checks.patterns.passed) {
    warnings.push('Suspicious patterns detected');
    recommendations.push('Document may be fraudulent - contact security team');
  }

  if (fraudScore >= 50) {
    recommendations.push('⚠️ HIGH RISK: Do not proceed without manual verification');
  } else if (fraudScore >= 30) {
    recommendations.push('⚠️ MEDIUM RISK: Review document carefully before use');
  }

  return {
    isAuthentic,
    isAuthorized,
    fraudScore,
    confidence,
    status,
    checks,
    warnings,
    recommendations,
  };
}

/**
 * Check document metadata for authenticity
 */
async function checkMetadata(
  content: string,
  metadata?: Record<string, any>
): Promise<{ passed: boolean; score: number; details: string }> {
  let score = 0;
  const details: string[] = [];

  // Check for suspicious metadata patterns
  const suspiciousPatterns = [
    /created\s*by\s*unknown/i,
    /author\s*:\s*unknown/i,
    /producer\s*:\s*unknown/i,
    /modification\s*date\s*:\s*unknown/i,
  ];

  let suspiciousCount = 0;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      suspiciousCount++;
    }
  }

  // Check for missing critical metadata
  const hasTitle = /title|document\s*name|filename/i.test(content);
  const hasDate = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(content);
  const hasAuthor = /author|signed\s*by|prepared\s*by/i.test(content);

  if (hasTitle) score += 20;
  if (hasDate) score += 20;
  if (hasAuthor) score += 20;

  if (suspiciousCount === 0) score += 20;
  else score += Math.max(0, 20 - suspiciousCount * 10);

  if (metadata) {
    if (metadata.title) score += 10;
    if (metadata.author) score += 10;
  }

  score = Math.min(100, score);
  const passed = score >= 60;

  if (passed) {
    details.push('Metadata appears valid');
  } else {
    details.push('Metadata check failed - missing or suspicious information');
  }

  return { passed, score, details: details.join('. ') };
}

/**
 * Check document integrity (tampering detection)
 */
async function checkIntegrity(
  buffer: Buffer,
  filename: string
): Promise<{ passed: boolean; score: number; details: string }> {
  let score = 50; // Base score
  const details: string[] = [];

  // Check file size (too small might indicate corruption)
  if (buffer.length < 100) {
    score -= 30;
    details.push('File size suspiciously small');
  } else if (buffer.length > 1000) {
    score += 20;
  }

  // Check for PDF structure integrity
  if (filename.toLowerCase().endsWith('.pdf')) {
    const pdfString = buffer.toString('utf-8', 0, Math.min(1000, buffer.length));
    const hasPdfHeader = pdfString.includes('%PDF');
    const hasPdfFooter = buffer.toString('utf-8', Math.max(0, buffer.length - 1000)).includes('%%EOF');

    if (hasPdfHeader && hasPdfFooter) {
      score += 20;
      details.push('PDF structure appears intact');
    } else {
      score -= 30;
      details.push('PDF structure may be corrupted');
    }
  }

  // Check for encryption (encrypted files might be legitimate but harder to verify)
  const hasEncryption = buffer.toString('utf-8', 0, Math.min(5000, buffer.length)).includes('/Encrypt');
  if (hasEncryption) {
    score -= 10;
    details.push('Document is encrypted - verification limited');
  }

  score = Math.max(0, Math.min(100, score));
  const passed = score >= 60;

  if (!passed && details.length === 0) {
    details.push('Integrity check inconclusive');
  }

  return { passed, score, details: details.join('. ') };
}

/**
 * Check for signatures and authorization
 */
async function checkSignatures(
  content: string
): Promise<{ passed: boolean; score: number; details: string }> {
  let score = 0;
  const details: string[] = [];

  // Look for signature indicators
  const signaturePatterns = [
    /signature|signed\s*by|authorized\s*by/i,
    /notary|notarized/i,
    /witness|witnessed/i,
    /seal|stamp/i,
    /certified|certification/i,
    /approved\s*by|authorized\s*signature/i,
  ];

  let signatureCount = 0;
  for (const pattern of signaturePatterns) {
    if (pattern.test(content)) {
      signatureCount++;
    }
  }

  if (signatureCount > 0) {
    score = Math.min(100, 40 + signatureCount * 15);
    details.push(`Found ${signatureCount} signature/authorization indicator(s)`);
  } else {
    score = 30;
    details.push('No clear signatures or authorization found');
  }

  // Check for date near signatures (more credible)
  const hasDateNearSignature = /(signature|signed|authorized).*?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i.test(content);
  if (hasDateNearSignature) {
    score += 20;
    details.push('Signature includes date');
  }

  score = Math.min(100, score);
  const passed = score >= 50;

  return { passed, score, details: details.join('. ') };
}

/**
 * Check content consistency
 */
async function checkConsistency(
  content: string
): Promise<{ passed: boolean; score: number; details: string }> {
  let score = 50;
  const details: string[] = [];

  // Check for contradictory information
  const contradictions: string[] = [];

  // Date inconsistencies
  const dates = content.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/g);
  if (dates && dates.length > 1) {
    // Simple check: if dates are very far apart, might be suspicious
    // This is a simplified check - real implementation would parse dates
    const uniqueDates = new Set(dates);
    if (uniqueDates.size < dates.length * 0.5) {
      contradictions.push('Multiple conflicting dates found');
    }
  }

  // Amount inconsistencies
  const amounts = content.match(/\$[\d,]+\.?\d*|[\d,]+\.?\d*\s*(dollars|USD)/gi);
  if (amounts && amounts.length > 1) {
    const uniqueAmounts = new Set(amounts.map(a => a.toLowerCase()));
    if (uniqueAmounts.size < amounts.length * 0.3) {
      contradictions.push('Conflicting monetary amounts found');
    }
  }

  // Name inconsistencies (very basic check)
  const namePattern = /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+/g;
  const names = content.match(namePattern);
  if (names && names.length > 3) {
    const uniqueNames = new Set(names);
    if (uniqueNames.size < names.length * 0.4) {
      contradictions.push('Unusual number of name variations');
    }
  }

  if (contradictions.length > 0) {
    score -= contradictions.length * 20;
    details.push(...contradictions);
  } else {
    score += 30;
    details.push('Content appears consistent');
  }

  // Check for suspicious formatting (all caps, excessive punctuation)
  const allCapsRatio = (content.match(/[A-Z]{5,}/g) || []).length / Math.max(1, content.split(/\s+/).length);
  if (allCapsRatio > 0.1) {
    score -= 15;
    details.push('Excessive use of capital letters (may indicate fraud)');
  }

  score = Math.max(0, Math.min(100, score));
  const passed = score >= 60;

  if (!passed && details.length === 0) {
    details.push('Consistency check inconclusive');
  }

  return { passed, score, details: details.join('. ') };
}

/**
 * Check for fraud patterns using AI
 */
async function checkFraudPatterns(
  content: string,
  filename: string
): Promise<{ passed: boolean; score: number; details: string }> {
  let score = 50;
  const details: string[] = [];

  try {
    const llm = getLLM();
    const prompt = `You are a document fraud detection expert. Analyze the following document excerpt for fraud indicators.

Document: ${filename}
Content excerpt (first 2000 chars): ${content.substring(0, 2000)}

Analyze for:
1. Suspicious language patterns
2. Unusual formatting
3. Missing critical information
4. Signs of tampering or editing
5. Inconsistencies in style or tone

Respond in JSON format:
{
  "fraudIndicators": ["list of specific indicators found"],
  "riskLevel": "low" | "medium" | "high",
  "confidence": 0-100,
  "explanation": "brief explanation"
}

If no fraud indicators are found, return empty array and "low" risk level.`;

    const response = await llm.invoke(prompt);
    const result = typeof response.content === 'string' 
      ? response.content.trim() 
      : JSON.stringify(response.content);

    // Parse response
    let parsed: any;
    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback analysis
      const lowerContent = content.toLowerCase();
      const fraudKeywords = [
        'urgent payment',
        'act now',
        'limited time',
        'guaranteed',
        'free money',
        'click here',
        'verify account',
        'suspended account',
      ];

      const foundKeywords = fraudKeywords.filter(kw => lowerContent.includes(kw));
      if (foundKeywords.length > 0) {
        parsed = {
          fraudIndicators: foundKeywords,
          riskLevel: 'medium',
          confidence: 60,
          explanation: `Found ${foundKeywords.length} suspicious keyword(s)`,
        };
      } else {
        parsed = {
          fraudIndicators: [],
          riskLevel: 'low',
          confidence: 70,
          explanation: 'No obvious fraud patterns detected',
        };
      }
    }

    // Calculate score based on AI analysis
    if (parsed.riskLevel === 'low') {
      score = 80;
    } else if (parsed.riskLevel === 'medium') {
      score = 40;
    } else {
      score = 10;
    }

    if (parsed.fraudIndicators && parsed.fraudIndicators.length > 0) {
      details.push(`AI detected ${parsed.fraudIndicators.length} fraud indicator(s): ${parsed.fraudIndicators.slice(0, 3).join(', ')}`);
      score -= parsed.fraudIndicators.length * 10;
    } else {
      details.push('No fraud patterns detected by AI analysis');
    }

    if (parsed.explanation) {
      details.push(parsed.explanation);
    }
  } catch (error) {
    console.error('Fraud pattern check error:', error);
    // Fallback to basic pattern matching
    const suspiciousPatterns = [
      /urgent.{0,20}payment/i,
      /act\s+now/i,
      /limited\s+time/i,
      /verify\s+your\s+account/i,
    ];

    let suspiciousCount = 0;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        suspiciousCount++;
      }
    }

    if (suspiciousCount > 0) {
      score = 30;
      details.push(`Found ${suspiciousCount} suspicious pattern(s)`);
    } else {
      score = 60;
      details.push('Basic pattern check passed');
    }
  }

  score = Math.max(0, Math.min(100, score));
  const passed = score >= 50;

  return { passed, score, details: details.join('. ') };
}

/**
 * Calculate overall confidence score
 */
function calculateConfidence(checks: VerificationResult['checks']): number {
  const weights = {
    metadata: 0.2,
    integrity: 0.25,
    signatures: 0.2,
    consistency: 0.2,
    patterns: 0.15,
  };

  const weightedScore =
    checks.metadata.score * weights.metadata +
    checks.integrity.score * weights.integrity +
    checks.signatures.score * weights.signatures +
    checks.consistency.score * weights.consistency +
    checks.patterns.score * weights.patterns;

  return Math.round(weightedScore);
}
