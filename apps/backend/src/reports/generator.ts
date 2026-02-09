/**
 * Report Generator
 * Creates PDF and Word reports
 */
import { pool } from '../db/pgvector.js';
import { getRiskTrendsDashboard } from '../analytics/dashboard.js';
import { getBenchmarkComparison } from '../benchmarking/industry.js';

export interface ReportOptions {
  format: 'pdf' | 'word';
  includeCharts: boolean;
  includeBenchmarks: boolean;
  period: {
    start: Date;
    end: Date;
  };
  userId?: string;
}

export interface ReportData {
  title: string;
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalDocuments: number;
    averageRiskScore: number;
    criticalCount: number;
    warningCount: number;
    normalCount: number;
  };
  trends?: any;
  benchmarks?: any;
  topRisks: Array<{
    document: string;
    riskLevel: string;
    riskCategory: string;
    uploadedAt: string;
  }>;
}

/**
 * Generate report data
 */
export async function generateReportData(options: ReportOptions): Promise<ReportData> {
  const client = await pool.connect();
  try {
    // Get summary statistics
    let query = `
      SELECT 
        COUNT(*) as total,
        AVG(CASE 
          WHEN risk_level = 'Critical' THEN 3
          WHEN risk_level = 'Warning' THEN 2
          WHEN risk_level = 'Normal' THEN 1
          ELSE 1
        END) as avg_risk,
        COUNT(*) FILTER (WHERE risk_level = 'Critical') as critical,
        COUNT(*) FILTER (WHERE risk_level = 'Warning') as warning,
        COUNT(*) FILTER (WHERE risk_level = 'Normal') as normal
      FROM documents
      WHERE uploaded_at BETWEEN $1 AND $2
    `;
    
    const params: any[] = [options.period.start, options.period.end];
    
    if (options.userId) {
      query += ` AND metadata->>'userId' = $3`;
      params.push(options.userId);
    }

    const summaryResult = await client.query(query, params);
    const summary = (summaryResult.rows[0] || {}) as Record<string, unknown>;

    // Get top risks
    let topRisksQuery = `
      SELECT filename, risk_level, risk_category, uploaded_at
      FROM documents
      WHERE uploaded_at BETWEEN $1 AND $2
        AND risk_level IN ('Critical', 'Warning')
    `;
    
    const topRisksParams: any[] = [options.period.start, options.period.end];
    if (options.userId) {
      topRisksQuery += ` AND metadata->>'userId' = $3`;
      topRisksParams.push(options.userId);
    }
    
    topRisksQuery += ` ORDER BY 
      CASE risk_level
        WHEN 'Critical' THEN 1
        WHEN 'Warning' THEN 2
      END,
      uploaded_at DESC
      LIMIT 10`;

    const topRisksResult = await client.query(topRisksQuery, topRisksParams);

    const reportData: ReportData = {
      title: 'Risk Analysis Report',
      generatedAt: new Date().toISOString(),
      period: {
        start: options.period.start.toISOString().split('T')[0],
        end: options.period.end.toISOString().split('T')[0],
      },
      summary: {
        totalDocuments: parseInt(String(summary.total || '0')),
        averageRiskScore: Math.round(parseFloat(String(summary.avg_risk || '0')) * 100) / 100,
        criticalCount: parseInt(String(summary.critical || '0')),
        warningCount: parseInt(String(summary.warning || '0')),
        normalCount: parseInt(String(summary.normal || '0')),
      },
      topRisks: topRisksResult.rows.map((row: any) => ({
        document: row.filename,
        riskLevel: row.risk_level,
        riskCategory: row.risk_category || 'None',
        uploadedAt: row.uploaded_at.toISOString().split('T')[0],
      })),
    };

    // Add trends if requested
    if (options.includeCharts) {
      reportData.trends = await getRiskTrendsDashboard(
        options.period.start,
        options.period.end,
        'week'
      );
    }

    // Add benchmarks if requested
    if (options.includeBenchmarks) {
      reportData.benchmarks = await getBenchmarkComparison(
        undefined, // industry
        options.userId,
        options.period.start,
        options.period.end
      );
    }

    return reportData;
  } finally {
    client.release();
  }
}

/**
 * Generate PDF report (using Puppeteer)
 */
export async function generatePDFReport(data: ReportData): Promise<Buffer> {
  // In production, use Puppeteer to generate PDF
  // For now, return HTML that can be converted to PDF
  
  const html = generateReportHTML(data);
  
  // Placeholder: In production, use Puppeteer
  // const browser = await puppeteer.launch();
  // const page = await browser.newPage();
  // await page.setContent(html);
  // const pdf = await page.pdf({ format: 'A4' });
  // await browser.close();
  // return pdf;
  
  // For now, return HTML as buffer (can be converted to PDF by frontend)
  return Buffer.from(html, 'utf-8');
}

/**
 * Generate Word report (using docx.js)
 */
export async function generateWordReport(data: ReportData): Promise<Buffer> {
  // In production, use docx.js to generate Word document
  // For now, return placeholder
  
  // Placeholder: In production, use docx.js
  // const doc = new Document();
  // doc.addSection({
  //   children: [
  //     new Paragraph({ text: data.title, heading: HeadingLevel.HEADING_1 }),
  //     ...
  //   ]
  // });
  // const buffer = await Packer.toBuffer(doc);
  // return buffer;
  
  // For now, return JSON (can be converted to Word by frontend)
  return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Generate HTML for report
 */
function generateReportHTML(data: ReportData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #333; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .metric { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #1890ff; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>${data.title}</h1>
  <p>Generated: ${new Date(data.generatedAt).toLocaleString()}</p>
  <p>Period: ${data.period.start} to ${data.period.end}</p>
  
  <h2>Summary</h2>
  <div class="summary">
    <div class="metric">
      <div>Total Documents</div>
      <div class="metric-value">${data.summary.totalDocuments}</div>
    </div>
    <div class="metric">
      <div>Average Risk Score</div>
      <div class="metric-value">${data.summary.averageRiskScore}</div>
    </div>
    <div class="metric">
      <div>Critical</div>
      <div class="metric-value">${data.summary.criticalCount}</div>
    </div>
    <div class="metric">
      <div>Warning</div>
      <div class="metric-value">${data.summary.warningCount}</div>
    </div>
  </div>
  
  <h2>Top Risks</h2>
  <table>
    <thead>
      <tr>
        <th>Document</th>
        <th>Risk Level</th>
        <th>Category</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      ${data.topRisks.map(risk => `
        <tr>
          <td>${risk.document}</td>
          <td>${risk.riskLevel}</td>
          <td>${risk.riskCategory}</td>
          <td>${risk.uploadedAt}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
  `;
}
