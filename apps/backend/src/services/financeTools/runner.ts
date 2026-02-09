/**
 * Finance & Tax Tools – LLM-based analysis runner
 * Runs the requested tool over provided document contents and returns structured output.
 */
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../../config/env.js';
import { getDocumentContent } from '../../db/pgvector.js';
import { getToolPrompt, type FinanceToolId } from './prompts.js';

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai?.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.2,
    });
  }
  return llm;
}

export interface DocumentInput {
  id: string;
  filename: string;
  content: string | null;
}

export interface ChartDataset {
  label: string;
  values: number[];
}

export interface FinanceToolChart {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  labels: string[];
  values?: number[];
  datasets?: ChartDataset[];
}

export interface FinanceToolResult {
  success: boolean;
  toolId: FinanceToolId;
  title: string;
  summary: string;
  sections: Array<{ heading: string; content: string; items?: string[] }>;
  charts?: FinanceToolChart[];
  youAreSafe?: boolean;
  nextCheckSuggested?: string;
  raw?: string;
  error?: string;
}

export interface RunOptions {
  /** Optional id -> filename map so we don't need to query DB without userId */
  idToFilename?: Map<string, string>;
}

export async function runFinanceTool(
  toolId: FinanceToolId,
  documentIds: string[],
  options?: RunOptions
): Promise<FinanceToolResult> {
  const promptConfig = getToolPrompt(toolId);
  if (!promptConfig) {
    return {
      success: false,
      toolId,
      title: toolId,
      summary: '',
      sections: [],
      error: `Unknown tool: ${toolId}`,
    };
  }

  const idToName = options?.idToFilename ?? new Map<string, string>();

  const documents: DocumentInput[] = [];
  for (const id of documentIds) {
    const content = await getDocumentContent(id);
    documents.push({
      id,
      filename: idToName.get(id) || id,
      content: content || '',
    });
  }

  const docBlocks = documents
    .map((d, i) => `--- Document ${i + 1} (${d.filename || d.id}) ---\n${(d.content || '').slice(0, 60000)}`)
    .join('\n\n');

  const userMessage = `Analyze the following documents and produce the requested output in the exact JSON format specified. Do not add markdown code fences.\n\n${docBlocks}`;

  try {
    const model = getLLM();
    const response = await model.invoke([
      { role: 'system', content: promptConfig.systemPrompt },
      { role: 'user', content: userMessage },
    ]);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const parsed = parseStructuredOutput(text, toolId, promptConfig.title);
    return { ...parsed, toolId, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      toolId,
      title: promptConfig.title,
      summary: '',
      sections: [],
      raw: message,
      error: message,
    };
  }
}

function parseStructuredOutput(
  text: string,
  toolId: FinanceToolId,
  title: string
): Omit<FinanceToolResult, 'toolId' | 'success'> {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {
      title,
      summary: text.slice(0, 500),
      sections: [{ heading: 'Analysis', content: text }],
      raw: text,
    };
  }

  const summary = (data.summary as string) || (data.summaryText as string) || '';
  const sections: FinanceToolResult['sections'] = [];
  if (Array.isArray(data.sections)) {
    for (const s of data.sections as Array<{ heading?: string; content?: string; items?: string[] }>) {
      sections.push({
        heading: s.heading || 'Section',
        content: s.content || '',
        items: s.items,
      });
    }
  }
  if (sections.length === 0 && (data.findings || data.items)) {
    const items = (data.findings as string[]) || (data.items as string[]) || [];
    sections.push({ heading: 'Findings', content: '', items });
  }

  let charts: FinanceToolResult['charts'];
  if (Array.isArray(data.charts)) {
    charts = [];
    for (const c of data.charts as Array<Record<string, unknown>>) {
      const type = (c.type as string) || 'bar';
      if (!['bar', 'line', 'pie', 'area'].includes(type)) continue;
      const labels = Array.isArray(c.labels) ? (c.labels as string[]) : [];
      const values = Array.isArray(c.values) ? (c.values as number[]) : [];
      const datasets = Array.isArray(c.datasets)
        ? (c.datasets as Array<{ label?: string; values?: number[] }>).map((d) => ({
            label: (d.label as string) || 'Series',
            values: Array.isArray(d.values) ? (d.values as number[]) : [],
          }))
        : undefined;
      if (labels.length || datasets?.length) {
        charts.push({
          type: type as FinanceToolChart['type'],
          title: (c.title as string) || 'Chart',
          labels,
          values: values.length ? values : undefined,
          datasets,
        });
      }
    }
  }

  const youAreSafe = data.youAreSafe === true;
  const nextCheckSuggested = typeof data.nextCheckSuggested === 'string' ? data.nextCheckSuggested : undefined;
  return { title, summary, sections, charts, youAreSafe, nextCheckSuggested, raw: cleaned };
}
