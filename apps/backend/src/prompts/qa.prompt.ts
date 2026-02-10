export function createQAPrompt(
  query: string,
  context: string,
  language: string = 'en',
  viewAs?: 'user' | 'manager' | 'auditor'
): string {
  const languageInstructions: Record<string, string> = {
    en: 'Answer in English.',
    es: 'Responde en español.',
    fr: 'Répondez en français.',
    de: 'Antworten Sie auf Deutsch.',
    zh: '用中文回答。',
    ja: '日本語で答えてください。',
    hi: 'हिंदी में उत्तर दें।',
    gu: 'ગુજરાતીમાં જવાબ આપો.',
    mr: 'मराठीमध्ये उत्तर द्या.',
  };

  const langInstruction = languageInstructions[language] || languageInstructions.en;

  const viewInstructions: Record<string, string> = {
    user: 'Tone: Simple and clear for a general user. Focus on what they need to know and do. Avoid jargon.',
    manager: 'Tone: For a manager. Emphasize risk, cost implications, and business impact. Summarize key obligations and exposure.',
    auditor: 'Tone: For an auditor/lawyer. Be precise. Cite specific clauses and document sections. Include legal/compliance citations where relevant.',
  };
  const viewInstruction = viewAs ? viewInstructions[viewAs] || '' : '';

  return `You are an intelligent document assistant. Your task is to answer questions based ONLY on the provided context from uploaded documents.

IMPORTANT RULES:
1. Answer STRICTLY from the provided context. Do not use any external knowledge.
2. If the answer is not in the context, say "I cannot find the answer in the provided documents."
3. ${langInstruction}
4. Provide clear, concise answers.
5. Include citations in your answer by referencing the source document when possible.
${viewInstruction ? `6. ${viewInstruction}` : ''}

CONTEXT FROM DOCUMENTS:
${context}

USER QUESTION:
${query}

ANSWER (based only on the context above):`;
}
