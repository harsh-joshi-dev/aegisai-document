declare module 'pg' {
  export interface PoolConfig {
    connectionString?: string;
  }
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number | null;
  }
  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<{
      query: <R = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<QueryResult<R>>;
      release: () => void;
    }>;
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
  }
  const pg: { Pool: typeof Pool };
  export default pg;
}
