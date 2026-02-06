/**
 * Smart Alerts System
 * Extracts dates and contract terms for alert generation
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
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
    });
  }
  return llm;
}

export interface ExtractedDate {
  type: 'expiration' | 'renewal' | 'deadline' | 'milestone' | 'payment';
  date: string; // ISO date string
  description: string;
  confidence: number;
}

export interface ContractAlert {
  documentId: string;
  documentName: string;
  alertType: 'expiring' | 'expired' | 'renewal_due' | 'deadline_approaching';
  date: string;
  daysUntil: number;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Extract dates from document text
 */
export async function extractDates(text: string): Promise<ExtractedDate[]> {
  try {
    const llm = getLLM();
    
    const prompt = `Extract all important dates from the following contract text. Focus on:
- Expiration dates
- Renewal dates
- Deadlines
- Milestones
- Payment due dates

Contract text:
${text.substring(0, 4000)}

Respond with JSON array:
[
  {
    "type": "expiration|renewal|deadline|milestone|payment",
    "date": "YYYY-MM-DD",
    "description": "what this date is for",
    "confidence": 0.0-1.0
  }
]`;

    const response = await llm.invoke(prompt);
    const result = typeof response.content === 'string' 
      ? response.content.trim() 
      : JSON.stringify(response.content);

    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const dates = JSON.parse(cleaned);
      
      // Validate and filter dates
      return dates
        .filter((d: any) => d.date && d.type)
        .map((d: any) => ({
          type: d.type,
          date: d.date,
          description: d.description || '',
          confidence: d.confidence || 0.7,
        }));
    } catch {
      return [];
    }
  } catch (error) {
    console.error('Date extraction error:', error);
    return [];
  }
}

/**
 * Generate alerts from extracted dates
 */
export function generateAlerts(
  documentId: string,
  documentName: string,
  dates: ExtractedDate[],
  alertThresholds: {
    expirationDays?: number;
    renewalDays?: number;
    deadlineDays?: number;
  } = {}
): ContractAlert[] {
  const {
    expirationDays = 30,
    renewalDays = 60,
    deadlineDays = 7,
  } = alertThresholds;

  const alerts: ContractAlert[] = [];
  const now = new Date();

  dates.forEach(dateInfo => {
    const date = new Date(dateInfo.date);
    if (isNaN(date.getTime())) return; // Invalid date

    const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    let alertType: ContractAlert['alertType'];
    let priority: ContractAlert['priority'] = 'medium';
    let threshold = 0;

    switch (dateInfo.type) {
      case 'expiration':
        threshold = expirationDays;
        if (daysUntil < 0) {
          alertType = 'expired';
          priority = 'high';
        } else if (daysUntil <= expirationDays) {
          alertType = 'expiring';
          priority = daysUntil <= 7 ? 'high' : 'medium';
        } else {
          return; // Not within threshold
        }
        break;
      
      case 'renewal':
        threshold = renewalDays;
        if (daysUntil <= renewalDays && daysUntil > 0) {
          alertType = 'renewal_due';
          priority = daysUntil <= 14 ? 'high' : 'medium';
        } else {
          return;
        }
        break;
      
      case 'deadline':
      case 'milestone':
      case 'payment':
        threshold = deadlineDays;
        if (daysUntil <= deadlineDays && daysUntil > 0) {
          alertType = 'deadline_approaching';
          priority = daysUntil <= 3 ? 'high' : 'medium';
        } else {
          return;
        }
        break;
      
      default:
        return;
    }

    alerts.push({
      documentId,
      documentName,
      alertType,
      date: dateInfo.date,
      daysUntil,
      description: dateInfo.description,
      priority,
    });
  });

  return alerts;
}
