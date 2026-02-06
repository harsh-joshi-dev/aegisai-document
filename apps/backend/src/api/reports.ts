/**
 * Reports API
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateReportData, generatePDFReport, generateWordReport } from '../reports/generator.js';

const router = Router();

const generateReportSchema = z.object({
  format: z.enum(['pdf', 'word']),
  includeCharts: z.boolean().optional().default(true),
  includeBenchmarks: z.boolean().optional().default(true),
  startDate: z.string(),
  endDate: z.string(),
  userId: z.string().optional(),
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const validated = generateReportSchema.parse(req.body);
    
    const options = {
      format: validated.format,
      includeCharts: validated.includeCharts,
      includeBenchmarks: validated.includeBenchmarks,
      period: {
        start: new Date(validated.startDate),
        end: new Date(validated.endDate),
      },
      userId: validated.userId,
    };

    const data = await generateReportData(options);
    
    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (validated.format === 'pdf') {
      buffer = await generatePDFReport(data);
      contentType = 'application/pdf';
      filename = `risk-report-${data.period.start}-${data.period.end}.pdf`;
    } else {
      buffer = await generateWordReport(data);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `risk-report-${data.period.start}-${data.period.end}.docx`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
