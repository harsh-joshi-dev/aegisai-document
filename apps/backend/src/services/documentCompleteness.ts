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

export interface MissingElement {
  category: string;
  item: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  reason: string;
  suggestion?: string;
}

export interface CompletenessAnalysis {
  completenessScore: number; // 0-100
  overallStatus: 'Complete' | 'Mostly Complete' | 'Incomplete' | 'Very Incomplete';
  missingElements: MissingElement[];
  summary: string;
  recommendations: string[];
}

/**
 * Analyze document for missing elements based on document type
 */
export async function analyzeDocumentCompleteness(
  documentContent: string,
  filename: string,
  documentType?: string
): Promise<CompletenessAnalysis> {
  // Infer document type from filename if not provided
  const inferredType = documentType || inferDocumentType(filename, documentContent);
  
  // Get expected elements for this document type
  const expectedElements = getExpectedElements(inferredType);
  
  try {
    const llm = getLLM();
    const prompt = `You are a document completeness analyst. Analyze the following document for missing elements.

Document Type: ${inferredType}
Filename: ${filename}

Expected Elements for ${inferredType}:
${expectedElements.map(e => `- ${e.name}: ${e.description}`).join('\n')}

Document Content (first 4000 characters):
${documentContent.substring(0, 4000)}

Analyze the document and identify:
1. Which expected elements are missing
2. Priority level for each missing element (Critical, High, Medium, Low)
3. Why each element is important
4. Suggestions for what should be included

Respond in JSON format:
{
  "completenessScore": 0-100,
  "overallStatus": "Complete" | "Mostly Complete" | "Incomplete" | "Very Incomplete",
  "missingElements": [
    {
      "category": "category name",
      "item": "specific missing item",
      "description": "what this item should contain",
      "priority": "Critical" | "High" | "Medium" | "Low",
      "reason": "why this is important",
      "suggestion": "what should be included (optional)"
    }
  ],
  "summary": "brief summary of completeness status",
  "recommendations": ["action item 1", "action item 2"]
}

If the document appears complete, return empty missingElements array and "Complete" status.`;

    const response = await llm.invoke(prompt);
    const result = typeof response.content === 'string' 
      ? response.content.trim() 
      : JSON.stringify(response.content);

    // Parse response
    let parsed: any;
    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      // Fallback analysis
      return performFallbackAnalysis(documentContent, inferredType, expectedElements);
    }

    // Validate and normalize response
    const completenessScore = Math.max(0, Math.min(100, parsed.completenessScore || calculateScore(parsed.missingElements || [])));
    const overallStatus = ['Complete', 'Mostly Complete', 'Incomplete', 'Very Incomplete'].includes(parsed.overallStatus)
      ? parsed.overallStatus as CompletenessAnalysis['overallStatus']
      : getStatusFromScore(completenessScore);

    const missingElements: MissingElement[] = (parsed.missingElements || []).map((el: any) => ({
      category: el.category || 'General',
      item: el.item || 'Unknown',
      description: el.description || '',
      priority: ['Critical', 'High', 'Medium', 'Low'].includes(el.priority) 
        ? el.priority as MissingElement['priority']
        : 'Medium',
      reason: el.reason || '',
      suggestion: el.suggestion,
    }));

    return {
      completenessScore,
      overallStatus,
      missingElements,
      summary: parsed.summary || generateSummary(completenessScore, missingElements.length),
      recommendations: parsed.recommendations || generateRecommendations(missingElements),
    };
  } catch (error) {
    console.error('Document completeness analysis error:', error);
    return performFallbackAnalysis(documentContent, inferredType, expectedElements);
  }
}

/**
 * Infer document type from filename and content
 */
function inferDocumentType(filename: string, content: string): string {
  const lowerFilename = filename.toLowerCase();
  const lowerContent = content.toLowerCase().substring(0, 1000);

  // Contract/Agreement
  if (lowerFilename.includes('contract') || lowerFilename.includes('agreement') || 
      lowerContent.includes('contract') || lowerContent.includes('agreement')) {
    return 'Contract';
  }

  // Invoice
  if (lowerFilename.includes('invoice') || lowerContent.includes('invoice')) {
    return 'Invoice';
  }

  // Purchase Order
  if (lowerFilename.includes('purchase order') || lowerFilename.includes('po') ||
      lowerContent.includes('purchase order')) {
    return 'Purchase Order';
  }

  // Legal Document
  if (lowerFilename.includes('legal') || lowerFilename.includes('legal document') ||
      lowerContent.includes('legal') || lowerContent.includes('attorney')) {
    return 'Legal Document';
  }

  // Policy
  if (lowerFilename.includes('policy') || lowerContent.includes('policy')) {
    return 'Policy';
  }

  // Terms and Conditions
  if (lowerFilename.includes('terms') || lowerFilename.includes('t&c') ||
      lowerContent.includes('terms and conditions')) {
    return 'Terms and Conditions';
  }

  // Proposal
  if (lowerFilename.includes('proposal') || lowerContent.includes('proposal')) {
    return 'Proposal';
  }

  // Report
  if (lowerFilename.includes('report') || lowerContent.includes('report')) {
    return 'Report';
  }

  // Default
  return 'General Document';
}

/**
 * Get expected elements for document type
 */
function getExpectedElements(documentType: string): Array<{ name: string; description: string }> {
  const elements: Record<string, Array<{ name: string; description: string }>> = {
    'Contract': [
      { name: 'Parties', description: 'Names and details of all parties involved' },
      { name: 'Effective Date', description: 'When the contract becomes effective' },
      { name: 'Term/Duration', description: 'Length of the contract period' },
      { name: 'Payment Terms', description: 'Payment schedule, amounts, and methods' },
      { name: 'Termination Clause', description: 'Conditions for contract termination' },
      { name: 'Signatures', description: 'Authorized signatures from all parties' },
      { name: 'Governing Law', description: 'Jurisdiction and applicable laws' },
      { name: 'Dispute Resolution', description: 'Process for resolving disputes' },
      { name: 'Confidentiality', description: 'Confidentiality and non-disclosure terms' },
      { name: 'Liability Limitations', description: 'Limitations of liability clauses' },
    ],
    'Invoice': [
      { name: 'Invoice Number', description: 'Unique invoice identifier' },
      { name: 'Invoice Date', description: 'Date the invoice was issued' },
      { name: 'Due Date', description: 'Payment due date' },
      { name: 'Bill To', description: 'Customer billing information' },
      { name: 'Itemized Charges', description: 'Detailed list of products/services' },
      { name: 'Subtotal', description: 'Subtotal before taxes' },
      { name: 'Tax Amount', description: 'Tax calculations' },
      { name: 'Total Amount', description: 'Final total amount due' },
      { name: 'Payment Instructions', description: 'How to make payment' },
      { name: 'Terms and Conditions', description: 'Payment terms and conditions' },
    ],
    'Purchase Order': [
      { name: 'PO Number', description: 'Unique purchase order number' },
      { name: 'Order Date', description: 'Date the order was placed' },
      { name: 'Vendor Information', description: 'Supplier/vendor details' },
      { name: 'Shipping Address', description: 'Delivery address' },
      { name: 'Itemized Products', description: 'List of items ordered with quantities' },
      { name: 'Pricing', description: 'Unit prices and total costs' },
      { name: 'Delivery Date', description: 'Expected delivery date' },
      { name: 'Payment Terms', description: 'Payment conditions' },
      { name: 'Approval Signatures', description: 'Authorized approver signatures' },
    ],
    'Legal Document': [
      { name: 'Document Title', description: 'Clear title of the document' },
      { name: 'Parties', description: 'All involved parties' },
      { name: 'Effective Date', description: 'When document takes effect' },
      { name: 'Legal Authority', description: 'Governing law or authority' },
      { name: 'Signatures', description: 'Required signatures' },
      { name: 'Witness', description: 'Witness signatures if required' },
      { name: 'Notarization', description: 'Notary seal if required' },
    ],
    'Policy': [
      { name: 'Policy Title', description: 'Name of the policy' },
      { name: 'Effective Date', description: 'When policy becomes effective' },
      { name: 'Policy Number', description: 'Unique policy identifier' },
      { name: 'Scope', description: 'What the policy covers' },
      { name: 'Responsibilities', description: 'Who is responsible for what' },
      { name: 'Compliance Requirements', description: 'Required compliance measures' },
      { name: 'Review Date', description: 'When policy should be reviewed' },
      { name: 'Approval', description: 'Approval signatures' },
    ],
    'Terms and Conditions': [
      { name: 'Effective Date', description: 'When terms become effective' },
      { name: 'Acceptance Method', description: 'How users accept terms' },
      { name: 'User Rights', description: 'Rights granted to users' },
      { name: 'User Obligations', description: 'User responsibilities' },
      { name: 'Service Description', description: 'What service is provided' },
      { name: 'Limitation of Liability', description: 'Liability limitations' },
      { name: 'Termination', description: 'Termination conditions' },
      { name: 'Dispute Resolution', description: 'How disputes are resolved' },
    ],
    'Proposal': [
      { name: 'Proposal Title', description: 'Name of the proposal' },
      { name: 'Date', description: 'Proposal date' },
      { name: 'Client Information', description: 'Client details' },
      { name: 'Scope of Work', description: 'What work will be done' },
      { name: 'Timeline', description: 'Project timeline and milestones' },
      { name: 'Pricing', description: 'Cost breakdown' },
      { name: 'Terms', description: 'Proposal terms and conditions' },
      { name: 'Validity Period', description: 'How long proposal is valid' },
    ],
    'Report': [
      { name: 'Report Title', description: 'Name of the report' },
      { name: 'Date', description: 'Report date' },
      { name: 'Author', description: 'Report author' },
      { name: 'Executive Summary', description: 'High-level summary' },
      { name: 'Findings', description: 'Key findings' },
      { name: 'Recommendations', description: 'Recommended actions' },
      { name: 'Appendices', description: 'Supporting materials' },
    ],
  };

  return elements[documentType] || [
    { name: 'Title', description: 'Document title' },
    { name: 'Date', description: 'Document date' },
    { name: 'Author/Sender', description: 'Who created the document' },
    { name: 'Recipient', description: 'Who the document is for' },
    { name: 'Purpose', description: 'Document purpose or objective' },
    { name: 'Key Information', description: 'Main content and details' },
    { name: 'Action Items', description: 'Required actions' },
    { name: 'Contact Information', description: 'How to contact relevant parties' },
  ];
}

/**
 * Fallback analysis when LLM fails
 */
function performFallbackAnalysis(
  content: string,
  documentType: string,
  expectedElements: Array<{ name: string; description: string }>
): CompletenessAnalysis {
  const missingElements: MissingElement[] = [];
  const lowerContent = content.toLowerCase();

  for (const element of expectedElements) {
    const elementLower = element.name.toLowerCase();
    const found = lowerContent.includes(elementLower) || 
                  element.description.toLowerCase().split(' ').some(word => 
                    word.length > 3 && lowerContent.includes(word)
                  );

    if (!found) {
      missingElements.push({
        category: 'Required',
        item: element.name,
        description: element.description,
        priority: element.name.includes('Date') || element.name.includes('Signature') ? 'Critical' : 'Medium',
        reason: `This is a standard element for ${documentType} documents`,
      });
    }
  }

  const completenessScore = calculateScore(missingElements);
  const overallStatus = getStatusFromScore(completenessScore);

  return {
    completenessScore,
    overallStatus,
    missingElements,
    summary: generateSummary(completenessScore, missingElements.length),
    recommendations: generateRecommendations(missingElements),
  };
}

/**
 * Calculate completeness score
 */
function calculateScore(missingElements: MissingElement[]): number {
  if (missingElements.length === 0) return 100;

  const priorityWeights = {
    Critical: 15,
    High: 10,
    Medium: 5,
    Low: 2,
  };

  const totalWeight = missingElements.reduce((sum, el) => sum + priorityWeights[el.priority], 0);
  const maxWeight = 100; // Assuming max 100 points can be deducted

  return Math.max(0, 100 - Math.min(maxWeight, totalWeight));
}

/**
 * Get status from score
 */
function getStatusFromScore(score: number): CompletenessAnalysis['overallStatus'] {
  if (score >= 90) return 'Complete';
  if (score >= 70) return 'Mostly Complete';
  if (score >= 50) return 'Incomplete';
  return 'Very Incomplete';
}

/**
 * Generate summary
 */
function generateSummary(score: number, missingCount: number): string {
  if (missingCount === 0) {
    return 'Document appears complete with all expected elements present.';
  }
  return `Document is ${score}% complete. ${missingCount} element${missingCount > 1 ? 's are' : ' is'} missing.`;
}

/**
 * Generate recommendations
 */
function generateRecommendations(missingElements: MissingElement[]): string[] {
  const recommendations: string[] = [];

  const critical = missingElements.filter(el => el.priority === 'Critical');
  const high = missingElements.filter(el => el.priority === 'High');

  if (critical.length > 0) {
    recommendations.push(`Add ${critical.length} critical missing element${critical.length > 1 ? 's' : ''}: ${critical.map(el => el.item).join(', ')}`);
  }

  if (high.length > 0) {
    recommendations.push(`Review and add high-priority elements: ${high.map(el => el.item).join(', ')}`);
  }

  if (missingElements.length > 0) {
    recommendations.push('Review document with legal/compliance team before finalizing');
  }

  return recommendations.length > 0 ? recommendations : ['Document appears complete'];
}
