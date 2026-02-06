/**
 * Contract Template Generation
 * Generate contract templates with AI and validate for risks
 */
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { classifyDocumentRisk } from '../services/classifier.js';

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o',
      temperature: 0.2, // Lower temperature for more consistent legal documents
    });
  }
  return llm;
}

export interface TemplateRequest {
  templateType: 'NDA' | 'MSA' | 'SOW' | 'Employment' | 'Service' | 'Custom';
  jurisdiction?: string; // e.g., "California", "New York", "UK"
  industry?: string; // e.g., "tech startup", "healthcare", "finance"
  customRequirements?: string;
  includeClauses?: string[]; // Specific clauses to include
  excludeClauses?: string[]; // Clauses to avoid
}

export interface GeneratedTemplate {
  template: string;
  riskAnalysis: {
    riskLevel: 'Critical' | 'Warning' | 'Normal';
    riskCategory: string;
    confidence: number;
    issues: string[];
    recommendations: string[];
  };
  metadata: {
    templateType: string;
    jurisdiction: string;
    generatedAt: Date;
    wordCount: number;
  };
}

/**
 * Generate a contract template
 */
export async function generateTemplate(request: TemplateRequest): Promise<GeneratedTemplate> {
  const llm = getLLM();
  
  // Build prompt based on template type
  const prompt = buildTemplatePrompt(request);
  
  console.log('📄 Generating contract template...');
  const response = await llm.invoke(prompt);
  const template = typeof response.content === 'string' 
    ? response.content.trim() 
    : JSON.stringify(response.content);
  
  // Clean up template (remove markdown if present)
  const cleanedTemplate = template
    .replace(/```markdown\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/^#+\s+/gm, '')
    .trim();
  
  // Analyze generated template for risks
  console.log('🔍 Analyzing template for risks...');
  const riskAnalysis = await analyzeTemplateRisks(cleanedTemplate);
  
  return {
    template: cleanedTemplate,
    riskAnalysis,
    metadata: {
      templateType: request.templateType,
      jurisdiction: request.jurisdiction || 'General',
      generatedAt: new Date(),
      wordCount: cleanedTemplate.split(/\s+/).length,
    },
  };
}

/**
 * Build prompt for template generation
 */
function buildTemplatePrompt(request: TemplateRequest): string {
  const { templateType, jurisdiction, industry, customRequirements, includeClauses, excludeClauses } = request;
  
  let prompt = `You are an expert legal document generator. Generate a professional ${templateType} contract template.`;

  if (jurisdiction) {
    prompt += `\n\nJurisdiction: ${jurisdiction}. Ensure compliance with ${jurisdiction} laws.`;
  }

  if (industry) {
    prompt += `\n\nIndustry: ${industry}. Tailor the contract for ${industry} sector.`;
  }

  if (includeClauses && includeClauses.length > 0) {
    prompt += `\n\nMust include these clauses:\n${includeClauses.map(c => `- ${c}`).join('\n')}`;
  }

  if (excludeClauses && excludeClauses.length > 0) {
    prompt += `\n\nDo NOT include these clauses:\n${excludeClauses.map(c => `- ${c}`).join('\n')}`;
  }

  if (customRequirements) {
    prompt += `\n\nAdditional requirements:\n${customRequirements}`;
  }

  prompt += `\n\nGenerate a complete, professional contract template with:
- Clear section headers
- Comprehensive terms and conditions
- Standard legal language
- Placeholders for specific details (marked as [PARTY_NAME], [DATE], etc.)
- Proper formatting

Do not include any markdown formatting. Return the contract text directly.`;

  return prompt;
}

/**
 * Analyze generated template for risks
 */
async function analyzeTemplateRisks(template: string): Promise<GeneratedTemplate['riskAnalysis']> {
  try {
    const riskAnalysis = await classifyDocumentRisk(template);
    
    // Additional analysis for common template issues
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check for placeholders
    const placeholderCount = (template.match(/\[.*?\]/g) || []).length;
    if (placeholderCount === 0) {
      issues.push('No placeholders found - template may be too generic');
      recommendations.push('Add placeholders for party names, dates, and specific terms');
    }
    
    // Check for common risk indicators
    const riskKeywords = ['unlimited liability', 'no warranty', 'as-is', 'no refund'];
    const foundRisks = riskKeywords.filter(keyword => 
      template.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (foundRisks.length > 0) {
      issues.push(`Found potentially risky terms: ${foundRisks.join(', ')}`);
      recommendations.push('Review these terms carefully before use');
    }
    
    // Check length
    const wordCount = template.split(/\s+/).length;
    if (wordCount < 500) {
      issues.push('Template is very short - may be missing important clauses');
      recommendations.push('Consider adding more comprehensive terms');
    }
    
    return {
      riskLevel: riskAnalysis.riskLevel,
      riskCategory: riskAnalysis.riskCategory,
      confidence: riskAnalysis.confidence,
      issues,
      recommendations: [...recommendations, ...riskAnalysis.recommendations],
    };
  } catch (error) {
    console.error('Template risk analysis error:', error);
    return {
      riskLevel: 'Normal',
      riskCategory: 'None',
      confidence: 0.5,
      issues: ['Could not complete risk analysis'],
      recommendations: ['Review template manually'],
    };
  }
}
