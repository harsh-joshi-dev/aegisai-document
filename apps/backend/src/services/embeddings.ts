import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config/env.js';

let embeddingsModel: OpenAIEmbeddings | null = null;

export function getEmbeddingsModel(): OpenAIEmbeddings {
  if (!embeddingsModel) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    embeddingsModel = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
      modelName: 'text-embedding-3-small', // Using smaller model for cost efficiency
      dimensions: 1536, // Standard embedding dimension
    });
  }
  
  return embeddingsModel;
}

// Validate text before sending to OpenAI
function validateText(text: string): void {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }
  
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Text cannot be empty');
  }
  
  // OpenAI has token limits (roughly 8000 tokens = ~32000 characters for embeddings)
  // Using 30000 characters as a safe limit
  if (trimmed.length > 30000) {
    throw new Error(`Text is too long (${trimmed.length} chars). Maximum is 30000 characters.`);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  validateText(text);
  const model = getEmbeddingsModel();
  const result = await model.embedQuery(text);
  return result;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    throw new Error('Texts array cannot be empty');
  }
  
  // Validate all texts
  texts.forEach((text, index) => {
    try {
      validateText(text);
    } catch (error) {
      throw new Error(`Invalid text at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  const model = getEmbeddingsModel();
  
  // Process in batches to avoid rate limits and handle errors gracefully
  const batchSize = 100; // OpenAI allows up to 2048 inputs per request, but we'll use smaller batches
  const results: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const batchResults = await model.embedDocuments(batch);
      results.push(...batchResults);
    } catch (error) {
      console.error(`Error generating embeddings for batch ${i}-${i + batch.length}:`, error);
      throw error;
    }
  }
  
  return results;
}
