/**
 * Storage for custom risk rules
 * In production, this would use a database
 */
import { CustomRule } from './ruleEngine.js';

// In-memory storage (replace with database)
const rulesStorage: Map<string, CustomRule> = new Map();

/**
 * Save a rule
 */
export async function saveRule(rule: CustomRule): Promise<CustomRule> {
  rulesStorage.set(rule.id, rule);
  return rule;
}

/**
 * Get a rule by ID
 */
export async function getRule(ruleId: string): Promise<CustomRule | null> {
  return rulesStorage.get(ruleId) || null;
}

/**
 * Get all rules for a user
 */
export async function getUserRules(userId: string): Promise<CustomRule[]> {
  return Array.from(rulesStorage.values()).filter(r => r.createdBy === userId);
}

/**
 * Get all enabled rules
 */
export async function getEnabledRules(): Promise<CustomRule[]> {
  return Array.from(rulesStorage.values()).filter(r => r.enabled);
}

/**
 * Update a rule
 */
export async function updateRule(ruleId: string, updates: Partial<CustomRule>): Promise<CustomRule | null> {
  const rule = rulesStorage.get(ruleId);
  if (!rule) {
    return null;
  }

  const updated = { ...rule, ...updates };
  rulesStorage.set(ruleId, updated);
  return updated;
}

/**
 * Delete a rule
 */
export async function deleteRule(ruleId: string): Promise<boolean> {
  return rulesStorage.delete(ruleId);
}

/**
 * Get all rules
 */
export async function getAllRules(): Promise<CustomRule[]> {
  return Array.from(rulesStorage.values());
}
