import { ExtractedData } from './extractorAgent.js';
import { RiskAnalysis } from './riskAnalystAgent.js';
import { ComplianceAnalysis } from './complianceAgent.js';
import { NegotiationStrategy } from './negotiationAgent.js';

export interface ActionItem {
  type: 'calendar' | 'payment' | 'notification' | 'routing' | 'reminder' | 'approval';
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  dueDate?: string;
  assignee?: string;
  metadata?: Record<string, any>;
}

export interface ActionPlan {
  actions: ActionItem[];
  autoExecutable: ActionItem[]; // Actions that can be auto-executed
  requiresApproval: ActionItem[]; // Actions needing human approval
  summary: string;
}

export function generateActionPlan(
  extractedData: ExtractedData,
  riskAnalysis: RiskAnalysis,
  complianceAnalysis: ComplianceAnalysis,
  negotiationStrategy: NegotiationStrategy,
  documentId: string,
  filename: string
): ActionPlan {
  const actions: ActionItem[] = [];
  const autoExecutable: ActionItem[] = [];
  const requiresApproval: ActionItem[] = [];

  // Generate calendar events from dates
  extractedData.dates.forEach(date => {
    if (date.importance === 'Critical' || date.importance === 'High') {
      const action: ActionItem = {
        type: 'calendar',
        title: date.description,
        description: `Deadline: ${date.date}`,
        priority: date.importance === 'Critical' ? 'Critical' : 'High',
        dueDate: date.date,
        metadata: {
          source: 'extracted_date',
          importance: date.importance,
        },
      };
      actions.push(action);
      if (date.importance === 'Critical') {
        requiresApproval.push(action);
      } else {
        autoExecutable.push(action);
      }
    }
  });

  // Generate reminders for obligations
  extractedData.obligations.forEach(obligation => {
    if (obligation.deadline) {
      const action: ActionItem = {
        type: 'reminder',
        title: `Obligation: ${obligation.obligation}`,
        description: `Party: ${obligation.party}${obligation.penalty ? ` | Penalty: ${obligation.penalty}` : ''}`,
        priority: obligation.penalty ? 'High' : 'Medium',
        dueDate: obligation.deadline,
        assignee: obligation.party,
        metadata: {
          source: 'obligation',
          penalty: obligation.penalty,
        },
      };
      actions.push(action);
      autoExecutable.push(action);
    }
  });

  // Generate payment actions
  extractedData.amounts.forEach(amount => {
    if (amount.frequency && amount.frequency !== 'One-time') {
      const action: ActionItem = {
        type: 'payment',
        title: `Payment: ${amount.description}`,
        description: `${amount.amount} ${amount.currency || 'USD'} - ${amount.frequency}`,
        priority: 'High',
        metadata: {
          source: 'payment',
          amount: amount.amount,
          currency: amount.currency,
          frequency: amount.frequency,
        },
      };
      actions.push(action);
      requiresApproval.push(action); // Payments always need approval
    }
  });

  // Generate routing actions for high-risk items
  if (riskAnalysis.riskScore >= 70) {
    const action: ActionItem = {
      type: 'routing',
      title: 'Route to Legal Team',
      description: `High risk document (Score: ${riskAnalysis.riskScore}/100) requires legal review`,
      priority: 'Critical',
      assignee: 'Legal Team',
      metadata: {
        source: 'risk_analysis',
        riskScore: riskAnalysis.riskScore,
      },
    };
    actions.push(action);
    requiresApproval.push(action);
  }

  // Generate notifications for critical issues
  complianceAnalysis.criticalIssues.forEach(issue => {
    const action: ActionItem = {
      type: 'notification',
      title: 'Compliance Issue',
      description: issue,
      priority: 'Critical',
      assignee: 'Compliance Team',
      metadata: {
        source: 'compliance',
      },
    };
    actions.push(action);
    requiresApproval.push(action);
  });

  // Generate approval requests for counter-proposals
  negotiationStrategy.counterProposals
    .filter(cp => cp.priority === 'Critical' || cp.priority === 'High')
    .forEach(proposal => {
      const action: ActionItem = {
        type: 'approval',
        title: `Negotiation Proposal: ${proposal.section}`,
        description: proposal.reason,
        priority: proposal.priority,
        assignee: 'Negotiation Team',
        metadata: {
          source: 'negotiation',
          originalText: proposal.originalText,
          proposedText: proposal.proposedText,
        },
      };
      actions.push(action);
      requiresApproval.push(action);
    });

  // Generate summary
  const summary = `Generated ${actions.length} action items:
- ${actions.filter(a => a.type === 'calendar').length} calendar events
- ${actions.filter(a => a.type === 'payment').length} payment reminders
- ${actions.filter(a => a.type === 'routing').length} routing actions
- ${actions.filter(a => a.type === 'notification').length} notifications
- ${actions.filter(a => a.type === 'approval').length} approval requests
- ${autoExecutable.length} can be auto-executed
- ${requiresApproval.length} require approval`;

  return {
    actions,
    autoExecutable,
    requiresApproval,
    summary,
  };
}
