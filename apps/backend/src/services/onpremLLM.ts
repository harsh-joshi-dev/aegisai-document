/**
 * On-Premise LLM Integration
 * Uses Ollama for local LLM inference (no data leaves the network)
 */
import { config } from '../config/env.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
export const USE_LOCAL_LLM = process.env.USE_LOCAL_LLM === 'true';

export interface LocalLLMConfig {
  model: string; // e.g., 'llama3', 'mistral', 'codellama'
  temperature?: number;
  maxTokens?: number;
}

/**
 * Call local LLM via Ollama
 */
export async function callLocalLLM(
  prompt: string,
  config: LocalLLMConfig = { model: 'llama3' }
): Promise<string> {
  if (!USE_LOCAL_LLM) {
    throw new Error('Local LLM not enabled');
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: {
          temperature: config.temperature || 0.7,
          num_predict: config.maxTokens || 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error) {
    console.error('Local LLM error:', error);
    throw new Error(`Failed to call local LLM: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if Ollama is available
 */
export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * List available models
 */
export async function listAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * Pull/download a model
 */
export async function pullModel(modelName: string): Promise<void> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: modelName,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Model pull error:', error);
    throw error;
  }
}
