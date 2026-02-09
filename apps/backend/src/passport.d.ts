declare module 'passport' {
  import { RequestHandler } from 'express';
  interface AuthenticateOptions {
    scope?: string | string[];
    session?: boolean;
  }
  interface PassportStatic {
    use(strategy: unknown): this;
    initialize(options?: { userProperty?: string }): RequestHandler;
    session(options?: { pauseStream?: boolean }): RequestHandler;
    authenticate(strategy: string, options?: AuthenticateOptions): RequestHandler;
    serializeUser(fn: (user: unknown, done: (err: unknown, id?: unknown) => void) => void): void;
    deserializeUser(fn: (id: unknown, done: (err: unknown, user?: unknown) => void) => void | Promise<void>): void;
  }
  const passport: PassportStatic;
  export default passport;
}
