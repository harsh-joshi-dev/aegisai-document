# Risk Engine – Aegis AI Decision Workspace

## Overview

The Risk Engine is the core of the Financial Risk Intelligence System. It aggregates signals from multiple sources (rules, patterns, AI) and computes a unified risk score and level for each document.

## Architecture

```
Document Upload
      │
      ▼
┌─────────────────────────────────────┐
│         Risk Engine                 │
│  calculateRisk(document, rules,     │
│    allTenantDocs, tenantId)         │
└─────────────────────────────────────┘
      │
      ├──► Rule Engine ────► RiskSignals (RULE)
      ├──► Pattern Engine ─► RiskSignals (PATTERN)
      └──► AI Engine (Phase 5) ─► RiskSignals (AI)
      │
      ▼
  Aggregate & Weight
      │
      ▼
  RiskResult (score, level, signals)
```

## Data Models

### RiskSignal
- `id`, `documentId`, `tenantId`
- `type`: 'RULE' | 'PATTERN' | 'AI'
- `severity`: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
- `title`, `description`, `recommendation`
- `confidenceScore` (0–100)
- `createdAt`

### RiskResult
- `documentId`, `tenantId`
- `score` (0–100)
- `level`: 'SAFE' | 'REVIEW' | 'HIGH' | 'CRITICAL'
- `signals`: RiskSignal[]
- `recommendations`: string[]
- `createdAt`

## Score Mapping

| Score Range | Level |
|-------------|-------|
| 0–25       | SAFE |
| 26–50      | REVIEW |
| 51–75      | HIGH |
| 76–100     | CRITICAL |

## Rule Engine

### Rule Types

1. **Threshold**: `amount > 100000`, `amount < 5000`, `amount >= 50000`
2. **Required Field**: `gst`, `vendor`, `amount`, `date`
3. **Consistency**: `amount > 0`, `gst valid`, `gst format`

### Config Format

- **Threshold**: `amount > 100000` (operators: >, <, >=, <=, ==, !=)
- **Required Field**: single field name, e.g. `gst`
- **Consistency**: `amount > 0`, `gst valid`, `gst format`

## Pattern Engine

Detects patterns across tenant documents:

- Duplicate amount across multiple vendors (> ₹50k)
- Rapid amount increase (2x previous max for same vendor)
- First high-value transaction with new vendor (> ₹1L)

## Testing

To add unit tests, install Vitest:

```bash
cd apps/web && npm install -D vitest @vitest/ui
```

Add to `package.json`:
```json
"scripts": {
  "test": "vitest",
  "test:run": "vitest run"
}
```

Test the risk engine:

```ts
import { calculateRisk } from './services/risk';
const result = calculateRisk({
  document: { id: 'd1', tenantId: 't1', amount: 150000 },
  rules: [{ id: 'r1', name: 'High amount', type: 'Threshold', config: 'amount > 100000', severity: 'High', weight: 10 }],
  allTenantDocs: [],
  tenantId: 't1',
});
expect(result.level).toBe('HIGH');
```
