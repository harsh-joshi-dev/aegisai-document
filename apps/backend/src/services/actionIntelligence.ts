/**
 * Action Intelligence: "What Should I Do Next?" for a document.
 * Returns immediate risks, required action, deadline/urgency, and who should handle (CA/Lawyer/User).
 */
import { getDocumentContent } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY is not set');
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.2,
    });
  }
  return llm;
}

export interface ActionIntelligenceResult {
  immediateRisks: Array<{ severity: 'Critical' | 'Warning'; description: string }>;
  actionRequired: string;
  deadline: string | null;
  urgency: 'Critical' | 'High' | 'Medium' | 'Low' | 'None';
  whoShouldHandle: 'CA' | 'Lawyer' | 'User' | 'Compliance' | 'Financial';
  summaryStatement: string;
  suggestedNextStep: string;
}

export async function getWhatShouldIDoNext(
  documentId: string,
  filename: string,
  riskLevel?: string,
  riskCategory?: string | null
): Promise<ActionIntelligenceResult> {
  const content = await getDocumentContent(documentId);
  if (!content) {
    return {
      immediateRisks: [],
      actionRequired: 'Document content could not be loaded. Please try re-uploading.',
      deadline: null,
      urgency: 'None',
      whoShouldHandle: 'User',
      summaryStatement: 'Unable to analyze this document.',
      suggestedNextStep: 'Re-upload the document or contact support.',
    };
  }

  const llm = getLLM();
  const prompt = `You are an action intelligence assistant. Based on this document, provide a clear "What should I do next?" answer.

Document: ${filename}
Risk level: ${riskLevel || 'Unknown'}
Risk category: ${riskCategory || 'Not specified'}

Document content (first 6000 characters):
${content.substring(0, 6000)}

Respond with ONLY a valid JSON object (no markdown, no extra text):
{
  "immediateRisks": [
    { "severity": "Critical" or "Warning", "description": "short description" }
  ],
  "actionRequired": "One clear sentence: what the user must do (e.g. 'Reply within 15 days', 'Consult a tax lawyer').",
  "deadline": "YYYY-MM-DD or relative (e.g. '15 days from receipt') or null if none",
  "urgency": "Critical" | "High" | "Medium" | "Low" | "None",
  "whoShouldHandle": "CA" | "Lawyer" | "User" | "Compliance" | "Financial",
  "summaryStatement": "One sentence for non-technical users, e.g. 'This notice requires a reply within 15 days. You should consult a tax lawyer.'",
  "suggestedNextStep": "One concrete next step (e.g. 'Contact a tax lawyer within 7 days')"
}`;

  try {
    const response = await llm.invoke(prompt);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as ActionIntelligenceResult;
    if (!parsed.immediateRisks) parsed.immediateRisks = [];
    if (!parsed.actionRequired) parsed.actionRequired = 'Review the document.';
    if (!parsed.whoShouldHandle) parsed.whoShouldHandle = 'User';
    if (!parsed.urgency) parsed.urgency = 'Medium';
    if (!parsed.summaryStatement) parsed.summaryStatement = parsed.actionRequired;
    if (!parsed.suggestedNextStep) parsed.suggestedNextStep = 'Review the document and take action as needed.';
    return parsed;
  } catch (e) {
    console.error('Action intelligence parse error:', e);
    return {
      immediateRisks: riskLevel === 'Critical' ? [{ severity: 'Critical', description: 'Document was classified as high risk. Professional review recommended.' }] : [],
      actionRequired: 'Review the document and consider professional advice if it involves legal, tax, or compliance matters.',
      deadline: null,
      urgency: riskLevel === 'Critical' ? 'High' : 'Medium',
      whoShouldHandle: riskCategory === 'Legal' ? 'Lawyer' : riskCategory === 'Financial' ? 'CA' : 'User',
      summaryStatement: 'This document may require action. Please review it and seek expert help if needed.',
      suggestedNextStep: 'Open the document in Chat to ask specific questions, or use Agent Swarm for a full analysis.',
    };
  }
}
