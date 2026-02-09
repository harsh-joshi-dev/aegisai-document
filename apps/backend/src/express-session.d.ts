declare module 'express-session' {
  import { RequestHandler } from 'express';
  interface SessionData {
    [key: string]: unknown;
  }
  function session(options?: unknown): RequestHandler;
  export default session;
}
