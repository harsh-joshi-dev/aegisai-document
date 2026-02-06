/**
 * Historical Analysis System
 * Track and analyze risk trends over time
 */
import { pool } from '../db/pgvector.js';

export interface RiskTrend {
  date: string;
  critical: number;
  warning: number;
  normal: number;
  total: number;
}

export interface RiskCategoryTrend {
  date: string;
  legal: number;
  financial: number;
  compliance: number;
  operational: number;
  none: number;
}

export interface TrendAnalysis {
  period: {
    start: string;
    end: string;
    days: number;
  };
  trends: {
    riskLevel: RiskTrend[];
    category: RiskCategoryTrend[];
  };
  insights: {
    overallTrend: 'increasing' | 'decreasing' | 'stable';
    peakRiskDate: string;
    averageRiskScore: number;
    recommendations: string[];
  };
}

/**
 * Get risk trends over time period
 */
export async function getRiskTrends(
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<TrendAnalysis> {
  // Calculate date grouping
  let dateFormat: string;
  let interval: string;
  
  switch (groupBy) {
    case 'day':
      dateFormat = 'YYYY-MM-DD';
      interval = '1 day';
      break;
    case 'week':
      dateFormat = 'IYYY-IW'; // ISO week
      interval = '1 week';
      break;
    case 'month':
      dateFormat = 'YYYY-MM';
      interval = '1 month';
      break;
  }

  // Query risk level trends
  const riskLevelQuery = `
    SELECT 
      TO_CHAR(uploaded_at, $1) as date,
      risk_level,
      COUNT(*) as count
    FROM documents
    WHERE uploaded_at BETWEEN $2 AND $3
    GROUP BY TO_CHAR(uploaded_at, $1), risk_level
    ORDER BY date, risk_level;
  `;

  const riskLevelResult = await pool.query(riskLevelQuery, [
    dateFormat,
    startDate,
    endDate,
  ]);

  // Query category trends
  const categoryQuery = `
    SELECT 
      TO_CHAR(uploaded_at, $1) as date,
      COALESCE(risk_category, 'None') as category,
      COUNT(*) as count
    FROM documents
    WHERE uploaded_at BETWEEN $2 AND $3
    GROUP BY TO_CHAR(uploaded_at, $1), risk_category
    ORDER BY date, category;
  `;

  const categoryResult = await pool.query(categoryQuery, [
    dateFormat,
    startDate,
    endDate,
  ]);

  // Process risk level trends
  const riskTrendsMap = new Map<string, { critical: number; warning: number; normal: number }>();
  
  riskLevelResult.rows.forEach((row: any) => {
    const date = row.date;
    if (!riskTrendsMap.has(date)) {
      riskTrendsMap.set(date, { critical: 0, warning: 0, normal: 0 });
    }
    const trend = riskTrendsMap.get(date)!;
    trend[row.risk_level.toLowerCase() as 'critical' | 'warning' | 'normal'] = parseInt(row.count);
  });

  const riskTrends: RiskTrend[] = Array.from(riskTrendsMap.entries()).map(([date, counts]) => ({
    date,
    critical: counts.critical,
    warning: counts.warning,
    normal: counts.normal,
    total: counts.critical + counts.warning + counts.normal,
  }));

  // Process category trends
  const categoryTrendsMap = new Map<string, { legal: number; financial: number; compliance: number; operational: number; none: number }>();
  
  categoryResult.rows.forEach((row: any) => {
    const date = row.date;
    if (!categoryTrendsMap.has(date)) {
      categoryTrendsMap.set(date, { legal: 0, financial: 0, compliance: 0, operational: 0, none: 0 });
    }
    const trend = categoryTrendsMap.get(date)!;
    const category = row.category.toLowerCase() as 'legal' | 'financial' | 'compliance' | 'operational' | 'none';
    if (category in trend) {
      trend[category] = parseInt(row.count);
    }
  });

  const categoryTrends: RiskCategoryTrend[] = Array.from(categoryTrendsMap.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));

  // Calculate insights
  const insights = calculateInsights(riskTrends, startDate, endDate);

  return {
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    },
    trends: {
      riskLevel: riskTrends,
      category: categoryTrends,
    },
    insights,
  };
}

/**
 * Calculate insights from trends
 */
function calculateInsights(
  trends: RiskTrend[],
  startDate: Date,
  endDate: Date
): TrendAnalysis['insights'] {
  if (trends.length === 0) {
    return {
      overallTrend: 'stable',
      peakRiskDate: '',
      averageRiskScore: 0,
      recommendations: ['No data available for analysis'],
    };
  }

  // Calculate overall trend
  const firstPeriod = trends[0];
  const lastPeriod = trends[trends.length - 1];
  const firstRiskScore = (firstPeriod.critical * 3 + firstPeriod.warning * 2 + firstPeriod.normal) / firstPeriod.total;
  const lastRiskScore = (lastPeriod.critical * 3 + lastPeriod.warning * 2 + lastPeriod.normal) / lastPeriod.total;
  
  let overallTrend: 'increasing' | 'decreasing' | 'stable';
  if (lastRiskScore > firstRiskScore * 1.1) {
    overallTrend = 'increasing';
  } else if (lastRiskScore < firstRiskScore * 0.9) {
    overallTrend = 'decreasing';
  } else {
    overallTrend = 'stable';
  }

  // Find peak risk date
  const peakRisk = trends.reduce((max, trend) => {
    const riskScore = (trend.critical * 3 + trend.warning * 2 + trend.normal) / trend.total;
    return riskScore > max.score ? { date: trend.date, score: riskScore } : max;
  }, { date: trends[0].date, score: 0 });

  // Calculate average risk score
  const totalRiskScore = trends.reduce((sum, trend) => {
    return sum + (trend.critical * 3 + trend.warning * 2 + trend.normal) / trend.total;
  }, 0);
  const averageRiskScore = totalRiskScore / trends.length;

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (overallTrend === 'increasing') {
    recommendations.push('Risk levels are increasing - review recent documents for patterns');
    recommendations.push('Consider implementing stricter risk controls');
  } else if (overallTrend === 'decreasing') {
    recommendations.push('Risk levels are decreasing - maintain current practices');
  }
  
  if (averageRiskScore > 2.0) {
    recommendations.push('Average risk score is high - consider document review process improvements');
  }

  const totalCritical = trends.reduce((sum, t) => sum + t.critical, 0);
  const totalDocs = trends.reduce((sum, t) => sum + t.total, 0);
  if (totalCritical / totalDocs > 0.2) {
    recommendations.push('High percentage of critical documents - investigate root causes');
  }

  return {
    overallTrend,
    peakRiskDate: peakRisk.date,
    averageRiskScore: Math.round(averageRiskScore * 100) / 100,
    recommendations,
  };
}

/**
 * Get risk exposure over time
 */
export async function getRiskExposure(months: number = 6): Promise<TrendAnalysis> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  return getRiskTrends(startDate, endDate, 'week');
}
