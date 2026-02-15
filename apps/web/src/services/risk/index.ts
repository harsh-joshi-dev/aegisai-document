/**
 * Risk Engine – Aegis AI Decision Workspace
 * Public exports for risk services.
 */

export { calculateRisk, calculateRiskAsync, riskResultToDocumentFields, type CalculateRiskInput, type DocumentForRisk } from './riskEngine';
export { analyzeDocumentWithAI, type DocumentForAI } from './aiEngine';
export { evaluateRules, type DocumentForRules } from './ruleEngine';
export { generatePatternSignals, type DocumentForPatterns } from './patternEngine';
export { compareDocuments, type DocumentForMatch } from './crossDocumentEngine';
export type { RiskSignal, RiskResult, RiskLevel, RiskSignalType, RiskSignalSeverity } from './types';
export { SCORE_TO_LEVEL, SEVERITY_WEIGHT } from './types';
