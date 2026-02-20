import express, { Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';
import { reconcileGstr } from '../services/gstReconciliation.js';
import { logAuditEvent } from '../compliance/auditLog.js';

const router = express.Router();

/**
 * GSTR-2A/2B Reconciliation
 * POST /api/gst/reconcile
 * Body: { from?: ISO date, to?: ISO date }
 */
router.post(
  '/reconcile',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer']),
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { from, to } = req.body || {};
      const result = await reconcileGstr(authReq.workspace.tenantId, {
        from: from || undefined,
        to: to || undefined,
      });

      await logAuditEvent(
        authReq.user.id,
        'gst_reconciliation_run',
        'compliance',
        authReq.workspace.tenantId,
        {
          tenantId: authReq.workspace.tenantId,
          period: result.period,
          totalInvoices: result.totalInvoices,
          matched: result.matched,
          mismatched: result.mismatched,
          itcAtRisk: result.summary.itcAtRisk,
        },
        req.ip,
        req.get('user-agent') || '',
        ['gst', 'compliance']
      );

      res.json({ success: true, reconciliation: result });
    } catch (error) {
      console.error('GST reconciliation error:', error);
      res.status(500).json({
        error: 'Reconciliation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * India Regulatory Calendar — upcoming compliance deadlines
 * GET /api/gst/calendar
 * Query: ?month=1-12&year=2026
 */
router.get(
  '/calendar',
  requireAuth,
  requireWorkspaceContext,
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();

      const deadlines = getIndiaRegulatoryDeadlines(year, month);
      const upcoming = deadlines.filter(d => {
        const dDate = new Date(d.dueDate);
        return dDate >= now;
      });

      res.json({
        success: true,
        year,
        month,
        deadlines,
        upcoming: upcoming.slice(0, 10),
        overdue: deadlines.filter(d => new Date(d.dueDate) < now).length,
      });
    } catch (error) {
      console.error('Regulatory calendar error:', error);
      res.status(500).json({
        error: 'Failed to fetch calendar',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ============================================================================
// India Regulatory Deadline Engine
// ============================================================================

interface RegulatoryDeadline {
  id: string;
  category: 'GST' | 'TDS' | 'Income Tax' | 'ROC' | 'ESI/PF';
  title: string;
  description: string;
  dueDate: string;
  applicableTo: string;
  penaltyInfo: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

function getIndiaRegulatoryDeadlines(year: number, month: number): RegulatoryDeadline[] {
  const deadlines: RegulatoryDeadline[] = [];
  const mm = String(month).padStart(2, '0');
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevMm = String(prevMonth).padStart(2, '0');
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const prevMonthName = monthNames[prevMonth];

  // GST returns — every month
  deadlines.push({
    id: `gstr1-${year}-${mm}`,
    category: 'GST',
    title: `GSTR-1 Filing (${prevMonthName} ${prevMonthYear})`,
    description: `Monthly return of outward supplies for ${prevMonthName} ${prevMonthYear}`,
    dueDate: `${year}-${mm}-11`,
    applicableTo: 'All registered taxpayers with turnover > ₹5 Cr or opted for monthly filing',
    penaltyInfo: 'Late fee: ₹50/day (₹20/day for nil return), max ₹10,000',
    severity: 'high',
  });

  deadlines.push({
    id: `gstr3b-${year}-${mm}`,
    category: 'GST',
    title: `GSTR-3B Filing (${prevMonthName} ${prevMonthYear})`,
    description: `Monthly summary return with tax payment for ${prevMonthName} ${prevMonthYear}`,
    dueDate: `${year}-${mm}-20`,
    applicableTo: 'All registered taxpayers (monthly filers)',
    penaltyInfo: 'Late fee: ₹50/day (₹20/day for nil return) + 18% interest on outstanding tax',
    severity: 'critical',
  });

  // TDS deadlines
  deadlines.push({
    id: `tds-deposit-${year}-${mm}`,
    category: 'TDS',
    title: `TDS/TCS Deposit (${prevMonthName} ${prevMonthYear})`,
    description: `Deposit tax deducted/collected at source during ${prevMonthName} ${prevMonthYear}`,
    dueDate: `${year}-${mm}-07`,
    applicableTo: 'All deductors/collectors',
    penaltyInfo: 'Interest: 1.5% per month on amount not deposited',
    severity: 'critical',
  });

  // Quarterly TDS return (for months ending quarter: March, June, September, December)
  if ([1, 4, 7, 10].includes(month)) {
    const qEndMonth = month === 1 ? 12 : month - 1;
    const quarterNames: Record<number, string> = { 3: 'Q4 (Jan-Mar)', 6: 'Q1 (Apr-Jun)', 9: 'Q2 (Jul-Sep)', 12: 'Q3 (Oct-Dec)' };
    const qName = quarterNames[qEndMonth] || '';
    deadlines.push({
      id: `tds-return-${year}-${mm}`,
      category: 'TDS',
      title: `TDS Return Filing ${qName}`,
      description: `Quarterly TDS return (Form 24Q/26Q/27Q) for ${qName}`,
      dueDate: month === 7 ? `${year}-07-31` : `${year}-${mm}-31`,
      applicableTo: 'All deductors',
      penaltyInfo: 'Late fee: ₹200/day under section 234E, max = TDS amount',
      severity: 'high',
    });
  }

  // ESI/PF
  deadlines.push({
    id: `pf-deposit-${year}-${mm}`,
    category: 'ESI/PF',
    title: `PF/ESI Deposit (${prevMonthName} ${prevMonthYear})`,
    description: `Employee PF and ESI contribution deposit for ${prevMonthName}`,
    dueDate: `${year}-${mm}-15`,
    applicableTo: 'Establishments with 20+ employees (PF) / 10+ employees (ESI)',
    penaltyInfo: 'Damages up to 25% for delayed PF deposit',
    severity: 'high',
  });

  // Specific annual/quarterly deadlines
  if (month === 7) {
    deadlines.push({
      id: `itr-individual-${year}`,
      category: 'Income Tax',
      title: `Income Tax Return (Individuals/HUF)`,
      description: `Annual ITR filing for FY ${year - 1}-${String(year).slice(2)} (non-audit cases)`,
      dueDate: `${year}-07-31`,
      applicableTo: 'Individuals, HUFs, and firms not requiring audit',
      penaltyInfo: 'Late fee: ₹5,000 (₹1,000 if income < ₹5L). Interest u/s 234A: 1% per month',
      severity: 'critical',
    });
  }

  if (month === 10) {
    deadlines.push({
      id: `itr-audit-${year}`,
      category: 'Income Tax',
      title: `ITR Filing (Audit Cases)`,
      description: `Annual ITR filing for entities requiring audit for FY ${year - 1}-${String(year).slice(2)}`,
      dueDate: `${year}-10-31`,
      applicableTo: 'Companies and entities requiring tax audit',
      penaltyInfo: 'Late fee: ₹5,000 + interest u/s 234A',
      severity: 'critical',
    });

    deadlines.push({
      id: `tax-audit-${year}`,
      category: 'Income Tax',
      title: `Tax Audit Report (Form 3CA/3CB)`,
      description: `Tax audit report for FY ${year - 1}-${String(year).slice(2)}`,
      dueDate: `${year}-09-30`,
      applicableTo: 'Businesses with turnover > ₹1 Cr (₹10 Cr if cash transactions < 5%)',
      penaltyInfo: 'Penalty: 0.5% of turnover or ₹1,50,000, whichever is less',
      severity: 'critical',
    });
  }

  // ROC annual filing
  if (month === 10 || month === 11) {
    deadlines.push({
      id: `roc-aoc4-${year}`,
      category: 'ROC',
      title: 'ROC Annual Filing (AOC-4)',
      description: `Annual financial statements filing with MCA for FY ${year - 1}-${String(year).slice(2)}`,
      dueDate: `${year}-10-30`,
      applicableTo: 'All companies registered under Companies Act 2013',
      penaltyInfo: 'Additional fee: ₹100/day of delay',
      severity: 'high',
    });

    deadlines.push({
      id: `roc-mgt7-${year}`,
      category: 'ROC',
      title: 'ROC Annual Return (MGT-7)',
      description: `Annual return filing with MCA for FY ${year - 1}-${String(year).slice(2)}`,
      dueDate: `${year}-11-29`,
      applicableTo: 'All companies registered under Companies Act 2013',
      penaltyInfo: 'Additional fee: ₹100/day of delay',
      severity: 'high',
    });
  }

  // GSTR-9 annual return
  if (month === 12) {
    deadlines.push({
      id: `gstr9-${year}`,
      category: 'GST',
      title: `GSTR-9 Annual Return (FY ${year - 1}-${String(year).slice(2)})`,
      description: 'Annual GST return consolidating all monthly/quarterly returns',
      dueDate: `${year}-12-31`,
      applicableTo: 'All registered taxpayers with aggregate turnover > ₹2 Cr',
      penaltyInfo: 'Late fee: ₹200/day (CGST + SGST), max 0.25% of turnover',
      severity: 'critical',
    });
  }

  // Sort by due date
  deadlines.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return deadlines;
}

export default router;
