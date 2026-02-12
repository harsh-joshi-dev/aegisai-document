/**
 * Sarvam AI integration - Indic language OCR and voice
 * Vision API for Gujarati/Hindi/Tamil etc.; Saaras v3 for 22 Indian languages
 */
import { config } from '../config/env.js';

const SARVAM_VISION_URL = 'https://api.sarvam.ai/vision';
const SARVAM_VOICE_URL = process.env.SARVAM_VOICE_URL || 'https://api.sarvam.ai/voice';

export type IndicLanguage = 'hi' | 'gu' | 'ta' | 'te' | 'mr' | 'bn' | 'kn' | 'ml' | 'en' | 'hinglish';

const SUPPORTED_INDIC_LANGUAGES: IndicLanguage[] = [
  'hi', 'gu', 'ta', 'te', 'mr', 'bn', 'kn', 'ml', 'en', 'hinglish',
];

export function getSupportedIndicLanguages(): IndicLanguage[] {
  return [...SUPPORTED_INDIC_LANGUAGES];
}

export interface SarvamVisionOptions {
  language?: IndicLanguage;
  detectDocumentType?: boolean;
}

export interface SarvamVisionResult {
  text: string;
  language?: string;
  documentType?: 'GST Return' | 'ITR' | 'Bank Statement' | 'Land Record' | 'Other';
  raw?: Record<string, unknown>;
}

/**
 * Sarvam Vision API - image-based OCR for Indic documents
 */
export async function sarvamVision(
  imageBase64: string,
  options: SarvamVisionOptions = {}
): Promise<SarvamVisionResult> {
  const apiKey = (config as { sarvam?: { apiKey?: string } }).sarvam?.apiKey
    || process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return {
      text: '',
      documentType: 'Other',
      raw: { error: 'SARVAM_API_KEY not set' },
    };
  }
  try {
    const body = {
      image: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
      language: options.language ?? 'hi',
      detect_document_type: options.detectDocumentType ?? true,
    };
    const res = await fetch(SARVAM_VISION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      return { text: '', documentType: 'Other', raw: { error: `${res.status} ${t}` } };
    }
    const data = (await res.json()) as { text?: string; language?: string; document_type?: string };
    return {
      text: data.text ?? '',
      language: data.language,
      documentType: mapDocumentType(data.document_type),
      raw: data as Record<string, unknown>,
    };
  } catch (e) {
    return {
      text: '',
      documentType: 'Other',
      raw: { error: e instanceof Error ? e.message : 'Unknown' },
    };
  }
}

function mapDocumentType(t?: string): SarvamVisionResult['documentType'] {
  if (!t) return 'Other';
  const u = t.toUpperCase();
  if (u.includes('GST')) return 'GST Return';
  if (u.includes('ITR') || u.includes('TAX')) return 'ITR';
  if (u.includes('BANK') || u.includes('STATEMENT')) return 'Bank Statement';
  if (u.includes('LAND') || u.includes('7/12') || u.includes('RECORD')) return 'Land Record';
  return 'Other';
}

export interface SarvamVoiceOptions {
  language: IndicLanguage | string;
  model?: string;
}

/**
 * Sarvam Saaras v3 - speech/voice for 22 Indian languages
 * Returns transcribed text from audio (or TTS response)
 */
export async function sarvamVoiceTranscribe(
  audioBase64: string,
  options: SarvamVoiceOptions
): Promise<{ text: string; language?: string }> {
  const apiKey = (config as { sarvam?: { apiKey?: string } }).sarvam?.apiKey
    || process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return { text: '' };
  }
  try {
    const body = {
      audio: audioBase64.startsWith('data:') ? audioBase64 : `data:audio/wav;base64,${audioBase64}`,
      language: options.language ?? 'hi',
      model: options.model ?? 'saaras-v3',
    };
    const res = await fetch(`${SARVAM_VOICE_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { text: '' };
    }
    const data = (await res.json()) as { text?: string; language?: string };
    return { text: data.text ?? '', language: data.language };
  } catch (_) {
    return { text: '' };
  }
}
