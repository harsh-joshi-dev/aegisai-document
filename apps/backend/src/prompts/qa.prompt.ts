export function createQAPrompt(query: string, context: string, language: string = 'en'): string {
  const languageInstructions: Record<string, string> = {
    en: 'Answer in English.',
    es: 'Responde en español.',
    fr: 'Répondez en français.',
    de: 'Antworten Sie auf Deutsch.',
    zh: '用中文回答。',
    ja: '日本語で答えてください。',
  };
  
  const langInstruction = languageInstructions[language] || languageInstructions.en;
  
  return `You are an intelligent document assistant. Your task is to answer questions based ONLY on the provided context from uploaded documents.

IMPORTANT RULES:
1. Answer STRICTLY from the provided context. Do not use any external knowledge.
2. If the answer is not in the context, say "I cannot find the answer in the provided documents."
3. ${langInstruction}
4. Provide clear, concise answers.
5. Include citations in your answer by referencing the source document when possible.

CONTEXT FROM DOCUMENTS:
${context}

USER QUESTION:
${query}

ANSWER (based only on the context above):`;
}
