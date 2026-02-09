declare module 'passport-google-oauth20' {
  export interface Profile {
    id: string;
    displayName?: string;
    name?: { familyName?: string; givenName?: string };
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
  }
  export type VerifyCallback = (err: unknown, user?: unknown) => void;
  export class Strategy {
    constructor(options: unknown, verify: (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void);
  }
}
