declare module 'connect-pg-simple' {
  function connectPgSimple(session: unknown): new (options?: unknown) => unknown;
  export default connectPgSimple;
}
