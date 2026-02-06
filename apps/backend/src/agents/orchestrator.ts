import { getDocumentContent } from '../db/pgvector.js';
import { extractDocumentData, ExtractedData } from './extractorAgent.js';
import { analyzeRisks, RiskAnalysis } from './riskAnalystAgent.js';
import { checkCompliance, ComplianceAnalysis } from './complianceAgent.js';
import { generateNegotiationStrategy, NegotiationStrategy } from './negotiationAgent.js';
import { generateActionPlan, ActionPlan } from './actionAgent.js';

export interface AgentSwarmResult {
  documentId: string;
  filename: string;
  status: 'completed' | 'partial' | 'failed';
  agents: {
    extractor: {
      status: 'completed' | 'failed';
      data?: ExtractedData;
      error?: string;
    };
    riskAnalyst: {
      status: 'completed' | 'failed';
      analysis?: RiskAnalysis;
      error?: string;
    };
    compliance: {
      status: 'completed' | 'failed';
      analysis?: ComplianceAnalysis;
      error?: string;
    };
    negotiation: {
      status: 'completed' | 'failed';
      strategy?: NegotiationStrategy;
      error?: string;
    };
    action: {
      status: 'completed' | 'failed';
      plan?: ActionPlan;
      error?: string;
    };
  };
  executionTime: number; // milliseconds
  timestamp: string;
}

export async function executeAgentSwarm(
  documentId: string,
  filename: string,
  userParty?: string,
  jurisdictions?: string[]
): Promise<AgentSwarmResult> {
  const startTime = Date.now();
  
  // Get document content
  let documentContent: string;
  try {
    const content = await getDocumentContent(documentId);
    if (!content) {
      throw new Error('Document content not found');
    }
    documentContent = content;
  } catch (error) {
    return {
      documentId,
      filename,
      status: 'failed',
      agents: {
        extractor: { status: 'failed', error: 'Failed to load document content' },
        riskAnalyst: { status: 'failed', error: 'Document content required' },
        compliance: { status: 'failed', error: 'Document content required' },
        negotiation: { status: 'failed', error: 'Document content required' },
        action: { status: 'failed', error: 'Document content required' },
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  const result: AgentSwarmResult = {
    documentId,
    filename,
    status: 'completed',
    agents: {
      extractor: { status: 'failed' },
      riskAnalyst: { status: 'failed' },
      compliance: { status: 'failed' },
      negotiation: { status: 'failed' },
      action: { status: 'failed' },
    },
    executionTime: 0,
    timestamp: new Date().toISOString(),
  };

  let extractedData: ExtractedData | null = null;
  let riskAnalysis: RiskAnalysis | null = null;
  let complianceAnalysis: ComplianceAnalysis | null = null;
  let negotiationStrategy: NegotiationStrategy | null = null;

  // Step 1: Extractor Agent (runs first, others depend on it)
  try {
    console.log(`[Agent Swarm] Starting Extractor Agent for ${filename}`);
    extractedData = await extractDocumentData(documentContent, filename);
    result.agents.extractor = { status: 'completed', data: extractedData };
    console.log(`[Agent Swarm] Extractor Agent completed: ${extractedData.terms.length} terms, ${extractedData.dates.length} dates`);
  } catch (error) {
    console.error('[Agent Swarm] Extractor Agent failed:', error);
    result.agents.extractor = {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    result.status = 'partial';
  }

  // Step 2: Risk Analyst Agent (depends on extractor)
  if (extractedData) {
    try {
      console.log(`[Agent Swarm] Starting Risk Analyst Agent for ${filename}`);
      riskAnalysis = await analyzeRisks(documentContent, extractedData, filename);
      result.agents.riskAnalyst = { status: 'completed', analysis: riskAnalysis };
      console.log(`[Agent Swarm] Risk Analyst Agent completed: Risk Score ${riskAnalysis.riskScore}/100`);
    } catch (error) {
      console.error('[Agent Swarm] Risk Analyst Agent failed:', error);
      result.agents.riskAnalyst = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      result.status = 'partial';
    }
  }

  // Step 3: Compliance Agent (depends on extractor)
  if (extractedData) {
    try {
      console.log(`[Agent Swarm] Starting Compliance Agent for ${filename}`);
      complianceAnalysis = await checkCompliance(documentContent, extractedData, filename, jurisdictions);
      result.agents.compliance = { status: 'completed', analysis: complianceAnalysis };
      console.log(`[Agent Swarm] Compliance Agent completed: ${complianceAnalysis.checks.length} jurisdictions checked`);
    } catch (error) {
      console.error('[Agent Swarm] Compliance Agent failed:', error);
      result.agents.compliance = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      result.status = 'partial';
    }
  }

  // Step 4: Negotiation Agent (depends on extractor, risk, compliance)
  if (extractedData && riskAnalysis && complianceAnalysis) {
    try {
      console.log(`[Agent Swarm] Starting Negotiation Agent for ${filename}`);
      negotiationStrategy = await generateNegotiationStrategy(
        documentContent,
        extractedData,
        riskAnalysis,
        complianceAnalysis,
        filename,
        userParty
      );
      result.agents.negotiation = { status: 'completed', strategy: negotiationStrategy };
      console.log(`[Agent Swarm] Negotiation Agent completed: ${negotiationStrategy.counterProposals.length} proposals`);
    } catch (error) {
      console.error('[Agent Swarm] Negotiation Agent failed:', error);
      result.agents.negotiation = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      result.status = 'partial';
    }
  }

  // Step 5: Action Agent (depends on all previous agents)
  if (extractedData && riskAnalysis && complianceAnalysis && negotiationStrategy) {
    try {
      console.log(`[Agent Swarm] Starting Action Agent for ${filename}`);
      const actionPlan = generateActionPlan(
        extractedData,
        riskAnalysis,
        complianceAnalysis,
        negotiationStrategy,
        documentId,
        filename
      );
      result.agents.action = { status: 'completed', plan: actionPlan };
      console.log(`[Agent Swarm] Action Agent completed: ${actionPlan.actions.length} actions generated`);
    } catch (error) {
      console.error('[Agent Swarm] Action Agent failed:', error);
      result.agents.action = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      result.status = 'partial';
    }
  }

  result.executionTime = Date.now() - startTime;
  console.log(`[Agent Swarm] Completed in ${result.executionTime}ms`);

  return result;
}
