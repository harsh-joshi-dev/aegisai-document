import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

const router = Router();

const translateRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  targetLanguage: z.string().default('en'),
});

let llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!llm) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
    });
  }

  return llm;
}

/**
 * Translate text to target language
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const validated = translateRequestSchema.parse(req.body);

    // Get language name for better translation
    const languageNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese',
      ar: 'Arabic',
      hi: 'Hindi',
      gu: 'Gujarati',
      nl: 'Dutch',
      pl: 'Polish',
      tr: 'Turkish',
      vi: 'Vietnamese',
      th: 'Thai',
      id: 'Indonesian',
      cs: 'Czech',
      sv: 'Swedish',
      da: 'Danish',
      fi: 'Finnish',
      no: 'Norwegian',
      he: 'Hebrew',
      uk: 'Ukrainian',
      ro: 'Romanian',
      hu: 'Hungarian',
      el: 'Greek',
      bg: 'Bulgarian',
      hr: 'Croatian',
      sk: 'Slovak',
      sl: 'Slovenian',
      et: 'Estonian',
      lv: 'Latvian',
      lt: 'Lithuanian',
      mt: 'Maltese',
      ga: 'Irish',
      cy: 'Welsh',
    };

    const targetLangName = languageNames[validated.targetLanguage] || validated.targetLanguage;

    const translatePrompt = `Translate the following text to ${targetLangName}. Preserve the meaning, tone, and formatting. Only return the translated text, nothing else.

Text to translate:
${validated.text}

Translated text in ${targetLangName}:`;

    const llm = getLLM();
    const response = await llm.invoke(translatePrompt);

    const translatedText = typeof response.content === 'string'
      ? response.content.trim()
      : JSON.stringify(response.content);

    res.json({
      success: true,
      translatedText,
      originalText: validated.text,
      targetLanguage: validated.targetLanguage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Translate error:', error);
    res.status(500).json({
      error: 'Failed to translate text',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
