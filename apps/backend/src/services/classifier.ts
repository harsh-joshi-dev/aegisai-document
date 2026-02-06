import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { createClassificationPrompt } from '../prompts/classify.prompt.js';
import { USE_LOCAL_LLM, callLocalLLM } from './onpremLLM.js';

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

export type RiskLevel = 'Critical' | 'Warning' | 'Normal';
export type RiskCategory = 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Medical' | 'None';

export interface RiskAnalysis {
  riskLevel: RiskLevel;
  riskCategory: RiskCategory;
  confidence: number; // 0.0 to 1.0
  explanation: string;
  recommendations: string[];
}

export async function classifyDocumentRisk(text: string): Promise<RiskAnalysis> {
  try {
    const prompt = createClassificationPrompt(text);
    
    // Use local LLM if enabled, otherwise use OpenAI
    let result: string;
    if (USE_LOCAL_LLM) {
      result = await callLocalLLM(prompt, { model: 'llama3', temperature: 0.1 });
    } else {
      const llm = getLLM();
      const response = await llm.invoke(prompt);
      result = typeof response.content === 'string' 
        ? response.content.trim() 
        : JSON.stringify(response.content);
    }
    
    // Try to parse JSON response
    let parsed: any;
    try {
      // Remove markdown code blocks if present
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      // Fallback: try to extract risk level from text
      const normalized = result.toLowerCase();
      let riskLevel: RiskLevel = 'Normal';
      if (normalized.includes('critical')) {
        riskLevel = 'Critical';
      } else if (normalized.includes('warning')) {
        riskLevel = 'Warning';
      }
      
      return {
        riskLevel,
        riskCategory: 'None' as RiskCategory,
        confidence: 0.5,
        explanation: 'Unable to generate detailed analysis. Please review the document manually.',
        recommendations: riskLevel === 'Critical' 
          ? ['Review document immediately', 'Check for sensitive information', 'Contact security team']
          : riskLevel === 'Warning'
          ? ['Review document', 'Verify compliance requirements']
          : ['Continue normal processing', 'Maintain regular backups']
      };
    }
    
    // Validate and return structured response
    const riskLevel = ['Critical', 'Warning', 'Normal'].includes(parsed.riskLevel) 
      ? parsed.riskLevel as RiskLevel 
      : 'Normal';
    
    const validCategories: RiskCategory[] = ['Legal', 'Financial', 'Compliance', 'Operational', 'Medical', 'None'];
    const riskCategory = validCategories.includes(parsed.riskCategory)
      ? parsed.riskCategory as RiskCategory
      : 'None';
    
    const confidence = typeof parsed.confidence === 'number' 
      ? Math.max(0, Math.min(1, parsed.confidence)) // Clamp between 0 and 1
      : 0.8; // Default confidence
    
    return {
      riskLevel,
      riskCategory,
      confidence,
      explanation: parsed.explanation || `Document classified as ${riskLevel} risk level.`,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
        ? parsed.recommendations
        : riskLevel === 'Critical'
        ? ['Review document immediately', 'Check for sensitive information', 'Contact security team']
        : riskLevel === 'Warning'
        ? ['Review document', 'Verify compliance requirements']
        : ['Continue normal processing', 'Maintain regular backups']
    };
  } catch (error) {
    console.error('Classification error:', error);
    // Default to Normal if classification fails
    return {
      riskLevel: 'Normal',
      riskCategory: 'None' as RiskCategory,
      confidence: 0.5,
      explanation: 'Classification service encountered an error. Document processed with default risk level.',
      recommendations: ['Review document manually', 'Verify content is appropriate', 'Contact support if issues persist']
    };
  }
}
