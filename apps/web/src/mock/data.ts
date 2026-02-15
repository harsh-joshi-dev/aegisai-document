import { DocumentRecord, RuleRecord, UserRecord } from './types';

/** Seed data: empty by default. Documents, rules, and users are added via app (upload, create rule, invite). */
export const documents: DocumentRecord[] = [];

export const rules: RuleRecord[] = [];

export const users: UserRecord[] = [];

/** Alerts are derived from documents in the dashboard (high/critical risk, pending). No static dummy alerts. */
export const alertsByWorkspace: Record<string, string[]> = {};
