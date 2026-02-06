/**
 * Industry Benchmarking System
 * Compares user's contracts to anonymized industry averages
 */
import { pool } from '../db/pgvector.js';

export interface BenchmarkMetrics {
  userMetrics: {
    averageRiskScore: number;
    criticalPercentage: number;
    warningPercentage: number;
    normalPercentage: number;
    topRiskCategory: string;
  };
  industryMetrics: {
    averageRiskScore: number;
    criticalPercentage: number;
    warningPercentage: number;
    normalPercentage: number;
    topRiskCategory: string;
  };
  comparison: {
    riskScoreDifference: number;
    riskScorePercentage: number;
    riskierThanAverage: boolean;
    insights: string[];
  };
}

/**
 * Get anonymized industry benchmarks
 * In production, this would aggregate data from multiple organizations
 */
async function getIndustryBenchmarks(industry?: string): Promise<BenchmarkMetrics['industryMetrics']> {
  // Placeholder: In production, this would query anonymized aggregate data
  // For now, return mock industry averages
  
  const benchmarks: Record<string, BenchmarkMetrics['industryMetrics']> = {
    default: {
      averageRiskScore: 1.5,
      criticalPercentage: 15,
      warningPercentage: 25,
      normalPercentage: 60,
      topRiskCategory: 'Legal',
    },
    tech: {
      averageRiskScore: 1.3,
      criticalPercentage: 12,
      warningPercentage: 22,
      normalPercentage: 66,
      topRiskCategory: 'Operational',
    },
    finance: {
      averageRiskScore: 1.8,
      criticalPercentage: 20,
      warningPercentage: 30,
      normalPercentage: 50,
      topRiskCategory: 'Financial',
    },
    healthcare: {
      averageRiskScore: 2.0,
      criticalPercentage: 22,
      warningPercentage: 28,
      normalPercentage: 50,
      topRiskCategory: 'Compliance',
    },
  };

  return benchmarks[industry || 'default'] || benchmarks.default;
}

/**
 * Calculate user metrics from their documents
 */
async function calculateUserMetrics(
  userId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<BenchmarkMetrics['userMetrics']> {
  const client = await pool.connect();
  try {
    let query = 'SELECT risk_level, risk_category FROM documents WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND metadata->>'userId' = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND uploaded_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND uploaded_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const result = await client.query(query, params);
    const documents = result.rows;

    if (documents.length === 0) {
      return {
        averageRiskScore: 0,
        criticalPercentage: 0,
        warningPercentage: 0,
        normalPercentage: 0,
        topRiskCategory: 'None',
      };
    }

    let critical = 0;
    let warning = 0;
    let normal = 0;
    const categoryCounts = new Map<string, number>();

    documents.forEach((doc: any) => {
      const level = doc.risk_level?.toLowerCase();
      if (level === 'critical') critical++;
      else if (level === 'warning') warning++;
      else if (level === 'normal') normal++;

      const category = doc.risk_category || 'None';
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });

    const total = documents.length;
    const averageRiskScore = (critical * 3 + warning * 2 + normal) / total;
    
    const topCategory = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
      averageRiskScore: Math.round(averageRiskScore * 100) / 100,
      criticalPercentage: Math.round((critical / total) * 100),
      warningPercentage: Math.round((warning / total) * 100),
      normalPercentage: Math.round((normal / total) * 100),
      topRiskCategory: topCategory,
    };
  } finally {
    client.release();
  }
}

/**
 * Get benchmarking comparison
 */
export async function getBenchmarkComparison(
  industry?: string,
  userId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<BenchmarkMetrics> {
  const userMetrics = await calculateUserMetrics(userId, startDate, endDate);
  const industryMetrics = await getIndustryBenchmarks(industry);

  const riskScoreDifference = userMetrics.averageRiskScore - industryMetrics.averageRiskScore;
  const riskScorePercentage = industryMetrics.averageRiskScore > 0
    ? (riskScoreDifference / industryMetrics.averageRiskScore) * 100
    : 0;

  const riskierThanAverage = riskScoreDifference > 0;

  // Generate insights
  const insights: string[] = [];
  
  if (Math.abs(riskScorePercentage) > 20) {
    if (riskierThanAverage) {
      insights.push(`Your contracts are ${Math.abs(Math.round(riskScorePercentage))}% riskier than the ${industry || 'industry'} average.`);
    } else {
      insights.push(`Your contracts are ${Math.abs(Math.round(riskScorePercentage))}% less risky than the ${industry || 'industry'} average.`);
    }
  }

  if (userMetrics.criticalPercentage > industryMetrics.criticalPercentage * 1.2) {
    insights.push(`You have ${Math.round(userMetrics.criticalPercentage - industryMetrics.criticalPercentage)}% more critical-risk documents than average.`);
  }

  if (userMetrics.topRiskCategory !== industryMetrics.topRiskCategory) {
    insights.push(`Your top risk category is ${userMetrics.topRiskCategory}, while industry average is ${industryMetrics.topRiskCategory}.`);
  }

  if (insights.length === 0) {
    insights.push('Your contract risk profile is aligned with industry standards.');
  }

  return {
    userMetrics,
    industryMetrics,
    comparison: {
      riskScoreDifference: Math.round(riskScoreDifference * 100) / 100,
      riskScorePercentage: Math.round(riskScorePercentage * 100) / 100,
      riskierThanAverage,
      insights,
    },
  };
}
