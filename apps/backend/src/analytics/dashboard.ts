/**
 * Risk Trends Dashboard
 * Aggregates and visualizes risk data over time
 */
import { pool } from '../db/pgvector.js';

export interface RiskTrendData {
  date: string;
  critical: number;
  warning: number;
  normal: number;
  total: number;
  riskScore: number; // Weighted average (Critical=3, Warning=2, Normal=1)
}

export interface CategoryTrendData {
  date: string;
  legal: number;
  financial: number;
  compliance: number;
  operational: number;
  none: number;
}

export interface RiskTrendsDashboard {
  period: {
    start: string;
    end: string;
    days: number;
  };
  riskLevelTrends: RiskTrendData[];
  categoryTrends: CategoryTrendData[];
  summary: {
    totalDocuments: number;
    averageRiskScore: number;
    peakRiskDate: string;
    peakRiskScore: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number;
  };
  topRiskCategories: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Get risk trends for dashboard visualization
 */
export async function getRiskTrendsDashboard(
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month' = 'week'
): Promise<RiskTrendsDashboard> {
  const client = await pool.connect();
  try {
    // Determine date format for grouping
    let dateFormat: string;
    switch (groupBy) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'IYYY-IW'; // ISO week
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
    }

    // Get risk level trends
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

    const riskLevelResult = await client.query(riskLevelQuery, [
      dateFormat,
      startDate,
      endDate,
    ]);

    // Get category trends
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

    const categoryResult = await client.query(categoryQuery, [
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
      const level = row.risk_level.toLowerCase();
      if (level === 'critical') trend.critical = parseInt(row.count);
      else if (level === 'warning') trend.warning = parseInt(row.count);
      else if (level === 'normal') trend.normal = parseInt(row.count);
    });

    const riskLevelTrends: RiskTrendData[] = Array.from(riskTrendsMap.entries()).map(([date, counts]) => {
      const total = counts.critical + counts.warning + counts.normal;
      const riskScore = total > 0
        ? (counts.critical * 3 + counts.warning * 2 + counts.normal) / total
        : 0;
      
      return {
        date,
        critical: counts.critical,
        warning: counts.warning,
        normal: counts.normal,
        total,
        riskScore: Math.round(riskScore * 100) / 100,
      };
    });

    // Process category trends
    const categoryTrendsMap = new Map<string, { legal: number; financial: number; compliance: number; operational: number; none: number }>();
    
    categoryResult.rows.forEach((row: any) => {
      const date = row.date;
      if (!categoryTrendsMap.has(date)) {
        categoryTrendsMap.set(date, { legal: 0, financial: 0, compliance: 0, operational: 0, none: 0 });
      }
      const trend = categoryTrendsMap.get(date)!;
      const category = row.category.toLowerCase();
      if (category in trend) {
        (trend as any)[category] = parseInt(row.count);
      }
    });

    const categoryTrends: CategoryTrendData[] = Array.from(categoryTrendsMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    // Calculate summary statistics
    const totalDocuments = riskLevelTrends.reduce((sum, t) => sum + t.total, 0);
    const averageRiskScore = riskLevelTrends.length > 0
      ? riskLevelTrends.reduce((sum, t) => sum + t.riskScore, 0) / riskLevelTrends.length
      : 0;

    const peakRisk = riskLevelTrends.reduce((max, trend) => {
      return trend.riskScore > max.score
        ? { date: trend.date, score: trend.riskScore }
        : max;
    }, { date: riskLevelTrends[0]?.date || '', score: 0 });

    // Calculate trend direction
    const firstScore = riskLevelTrends[0]?.riskScore || 0;
    const lastScore = riskLevelTrends[riskLevelTrends.length - 1]?.riskScore || 0;
    const trendPercentage = firstScore > 0
      ? ((lastScore - firstScore) / firstScore) * 100
      : 0;
    
    let trendDirection: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(trendPercentage) < 5) {
      trendDirection = 'stable';
    } else if (trendPercentage > 0) {
      trendDirection = 'increasing';
    } else {
      trendDirection = 'decreasing';
    }

    // Get top risk categories
    const categoryCounts = new Map<string, number>();
    categoryResult.rows.forEach((row: any) => {
      const category = row.category;
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + parseInt(row.count));
    });

    const topRiskCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: totalDocuments > 0 ? (count / totalDocuments) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      riskLevelTrends,
      categoryTrends,
      summary: {
        totalDocuments,
        averageRiskScore: Math.round(averageRiskScore * 100) / 100,
        peakRiskDate: peakRisk.date,
        peakRiskScore: Math.round(peakRisk.score * 100) / 100,
        trendDirection,
        trendPercentage: Math.round(trendPercentage * 100) / 100,
      },
      topRiskCategories,
    };
  } finally {
    client.release();
  }
}
