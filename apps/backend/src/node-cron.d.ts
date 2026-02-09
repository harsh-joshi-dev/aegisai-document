declare module 'node-cron' {
  function schedule(
    expression: string,
    task: () => void,
    options?: { scheduled?: boolean; timezone?: string }
  ): { start: () => void; stop: () => void; destroy: () => void };
}
