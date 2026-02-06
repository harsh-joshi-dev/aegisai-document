/**
 * Multi-Agent Negotiation Preparation System
 * Uses multiple AI agents to prepare for contract negotiations
 */
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o',
      temperature: 0.3,
    });
  }
  return llm;
}

export interface NegotiationPrepResult {
  extractedTerms: {
    keyTerms: Array<{ term: string; value: string; importance: string }>;
    riskAreas: string[];
    favorableTerms: string[];
    unfavorableTerms: string[];
  };
  marketResearch: {
    standardRanges: Array<{ term: string; typicalRange: string; source: string }>;
    industryBenchmarks: string[];
    recommendations: string[];
  };
  counterProposal: {
    suggestedChanges: Array<{
      originalTerm: string;
      suggestedChange: string;
      rationale: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    negotiationPoints: string[];
    redLines: string[]; // Terms that should not be accepted
  };
}

/**
 * Agent 1: Extract and analyze contract terms
 */
async function agentExtractTerms(documentText: string): Promise<NegotiationPrepResult['extractedTerms']> {
  const llm = getLLM();
  
  const prompt = `You are a contract analysis expert. Analyze the following contract and extract:

1. Key terms and their values (payment terms, deadlines, penalties, etc.)
2. Risk areas that need attention
3. Terms that are favorable to the client
4. Terms that are unfavorable to the client

Contract text:
${documentText.substring(0, 4000)}

Respond with JSON:
{
  "keyTerms": [{"term": "...", "value": "...", "importance": "high/medium/low"}],
  "riskAreas": ["..."],
  "favorableTerms": ["..."],
  "unfavorableTerms": ["..."]
}`;

  const response = await llm.invoke(prompt);
  const result = typeof response.content === 'string' 
    ? response.content.trim() 
    : JSON.stringify(response.content);

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback
    return {
      keyTerms: [],
      riskAreas: [],
      favorableTerms: [],
      unfavorableTerms: [],
    };
  }
}

/**
 * Agent 2: Research market standards
 */
async function agentResearchMarket(
  extractedTerms: NegotiationPrepResult['extractedTerms']
): Promise<NegotiationPrepResult['marketResearch']> {
  const llm = getLLM();
  
  const keyTermsList = extractedTerms.keyTerms.map(t => `${t.term}: ${t.value}`).join('\n');
  
  const prompt = `You are a market research expert. Based on these contract terms, provide:

1. Typical market ranges for each key term
2. Industry benchmarks
3. Recommendations based on market standards

Contract terms:
${keyTermsList}

Unfavorable terms to research:
${extractedTerms.unfavorableTerms.join(', ')}

Respond with JSON:
{
  "standardRanges": [{"term": "...", "typicalRange": "...", "source": "industry knowledge"}],
  "industryBenchmarks": ["..."],
  "recommendations": ["..."]
}`;

  const response = await llm.invoke(prompt);
  const result = typeof response.content === 'string' 
    ? response.content.trim() 
    : JSON.stringify(response.content);

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      standardRanges: [],
      industryBenchmarks: [],
      recommendations: [],
    };
  }
}

/**
 * Agent 3: Draft counter-proposal
 */
async function agentDraftCounterProposal(
  extractedTerms: NegotiationPrepResult['extractedTerms'],
  marketResearch: NegotiationPrepResult['marketResearch']
): Promise<NegotiationPrepResult['counterProposal']> {
  const llm = getLLM();
  
  const prompt = `You are a negotiation strategist. Based on the contract analysis and market research, create a counter-proposal strategy.

Extracted Terms:
${JSON.stringify(extractedTerms, null, 2)}

Market Research:
${JSON.stringify(marketResearch, null, 2)}

Create:
1. Suggested changes for unfavorable terms
2. Key negotiation points
3. Red lines (terms that should not be accepted)

Respond with JSON:
{
  "suggestedChanges": [{
    "originalTerm": "...",
    "suggestedChange": "...",
    "rationale": "...",
    "priority": "high/medium/low"
  }],
  "negotiationPoints": ["..."],
  "redLines": ["..."]
}`;

  const response = await llm.invoke(prompt);
  const result = typeof response.content === 'string' 
    ? response.content.trim() 
    : JSON.stringify(response.content);

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      suggestedChanges: [],
      negotiationPoints: [],
      redLines: [],
    };
  }
}

/**
 * Main function: Run all agents in sequence
 */
export async function prepareNegotiation(documentText: string): Promise<NegotiationPrepResult> {
  console.log('🤖 Agent 1: Extracting terms...');
  const extractedTerms = await agentExtractTerms(documentText);
  
  console.log('🔍 Agent 2: Researching market standards...');
  const marketResearch = await agentResearchMarket(extractedTerms);
  
  console.log('📝 Agent 3: Drafting counter-proposal...');
  const counterProposal = await agentDraftCounterProposal(extractedTerms, marketResearch);
  
  return {
    extractedTerms,
    marketResearch,
    counterProposal,
  };
}
