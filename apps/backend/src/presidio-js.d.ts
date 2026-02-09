declare module '@microsoft/presidio-js' {
  export class PresidioAnalyzer {
    analyze(input: unknown): Promise<unknown>;
  }
  export class PresidioAnonymizer {
    anonymize(input: unknown): Promise<unknown>;
  }
}
