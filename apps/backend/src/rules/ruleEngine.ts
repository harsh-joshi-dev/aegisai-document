/**
 * Custom Risk Rules Engine
 * Allows users to define custom rules for risk detection
 */
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { generateEmbedding } from '../services/embeddings.js';
import { searchSimilarChunks } from '../db/pgvector.js';

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'keyword' | 'pattern' | 'semantic' | 'gpt-classification';
  pattern?: string; // For keyword/pattern rules
  keywords?: string[]; // For keyword rules
  prompt?: string; // For GPT classification rules
  riskLevel: 'Critical' | 'Warning' | 'Normal';
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  matchedText: string;
  confidence: number;
  riskLevel: 'Critical' | 'Warning' | 'Normal';
  context?: string;
}

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
    });
  }
  return llm;
}

/**
 * Evaluate a document against custom rules
 */
export async function evaluateRules(
  text: string,
  rules: CustomRule[]
): Promise<RuleMatch[]> {
  const matches: RuleMatch[] = [];
  const enabledRules = rules.filter(r => r.enabled);

  for (const rule of enabledRules) {
    let match: RuleMatch | null = null;

    switch (rule.ruleType) {
      case 'keyword':
        match = await evaluateKeywordRule(text, rule);
        break;
      case 'pattern':
        match = await evaluatePatternRule(text, rule);
        break;
      case 'semantic':
        match = await evaluateSemanticRule(text, rule);
        break;
      case 'gpt-classification':
        match = await evaluateGPTRule(text, rule);
        break;
    }

    if (match) {
      matches.push(match);
    }
  }

  return matches;
}

/**
 * Evaluate keyword-based rule
 */
async function evaluateKeywordRule(
  text: string,
  rule: CustomRule
): Promise<RuleMatch | null> {
  if (!rule.keywords || rule.keywords.length === 0) {
    return null;
  }

  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let matchedText = '';

  for (const keyword of rule.keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerText.includes(lowerKeyword)) {
      matchedKeywords.push(keyword);
      // Extract context around keyword
      const index = lowerText.indexOf(lowerKeyword);
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + keyword.length + 50);
      matchedText = text.substring(start, end);
      break; // First match
    }
  }

  if (matchedKeywords.length > 0) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matchedText,
      confidence: 0.9, // High confidence for exact keyword matches
      riskLevel: rule.riskLevel,
      context: `Matched keywords: ${matchedKeywords.join(', ')}`,
    };
  }

  return null;
}

/**
 * Evaluate regex pattern rule
 */
async function evaluatePatternRule(
  text: string,
  rule: CustomRule
): Promise<RuleMatch | null> {
  if (!rule.pattern) {
    return null;
  }

  try {
    const regex = new RegExp(rule.pattern, 'gi');
    const matches = text.match(regex);

    if (matches && matches.length > 0) {
      // Extract context around first match
      const firstMatch = matches[0];
      const index = text.indexOf(firstMatch);
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + firstMatch.length + 50);
      const context = text.substring(start, end);

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matchedText: firstMatch,
        confidence: 0.85,
        riskLevel: rule.riskLevel,
        context,
      };
    }
  } catch (error) {
    console.error(`Invalid regex pattern for rule ${rule.id}:`, error);
  }

  return null;
}

/**
 * Evaluate semantic rule using embeddings
 */
async function evaluateSemanticRule(
  text: string,
  rule: CustomRule
): Promise<RuleMatch | null> {
  if (!rule.description) {
    return null;
  }

  try {
    // Generate embedding for rule description
    const ruleEmbedding = await generateEmbedding(rule.description);
    
    // Search for similar content in document chunks
    const similarChunks = await searchSimilarChunks(ruleEmbedding, 3, 0.6);
    
    if (similarChunks.length > 0) {
      const bestMatch = similarChunks[0];
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matchedText: bestMatch.content.substring(0, 200),
        confidence: bestMatch.similarity,
        riskLevel: rule.riskLevel,
        context: `Semantic similarity: ${(bestMatch.similarity * 100).toFixed(1)}%`,
      };
    }
  } catch (error) {
    console.error(`Error evaluating semantic rule ${rule.id}:`, error);
  }

  return null;
}

/**
 * Evaluate GPT-based classification rule
 */
async function evaluateGPTRule(
  text: string,
  rule: CustomRule
): Promise<RuleMatch | null> {
  if (!rule.prompt) {
    return null;
  }

  try {
    const llm = getLLM();
    const prompt = `${rule.prompt}

Document text to analyze:
${text.substring(0, 3000)}

Respond with JSON:
{
  "matches": true/false,
  "confidence": 0.0-1.0,
  "matched_text": "relevant excerpt",
  "reason": "explanation"
}`;

    const response = await llm.invoke(prompt);
    const result = typeof response.content === 'string' 
      ? response.content.trim() 
      : JSON.stringify(response.content);

    // Parse JSON response
    let parsed: any;
    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: check if response indicates match
      const lowerResult = result.toLowerCase();
      if (lowerResult.includes('match') || lowerResult.includes('yes') || lowerResult.includes('true')) {
        parsed = { matches: true, confidence: 0.7 };
      } else {
        return null;
      }
    }

    if (parsed.matches) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matchedText: parsed.matched_text || text.substring(0, 200),
        confidence: parsed.confidence || 0.7,
        riskLevel: rule.riskLevel,
        context: parsed.reason || 'GPT classification match',
      };
    }
  } catch (error) {
    console.error(`Error evaluating GPT rule ${rule.id}:`, error);
  }

  return null;
}

/**
 * Create a new custom rule
 */
export function createRule(ruleData: Omit<CustomRule, 'id' | 'createdAt'>): CustomRule {
  return {
    ...ruleData,
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
  };
}
