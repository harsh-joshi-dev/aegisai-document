export interface Chunk {
  content: string;
  metadata: {
    page?: number;
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): Chunk[] {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap || DEFAULT_CHUNK_OVERLAP;
  
  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  
  // Split text into sentences for better chunking
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';
  let currentStart = 0;
  let charIndex = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const potentialChunk = currentChunk + sentence;
    
    if (potentialChunk.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          chunkIndex: chunkIndex++,
          startChar: currentStart,
          endChar: charIndex - sentence.length,
        },
      });
      
      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-chunkOverlap);
      currentChunk = overlapText + sentence;
      currentStart = charIndex - chunkOverlap;
    } else {
      if (currentChunk === '') {
        currentStart = charIndex;
      }
      currentChunk = potentialChunk;
    }
    
    charIndex += sentence.length;
  }
  
  // Add the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        chunkIndex: chunkIndex,
        startChar: currentStart,
        endChar: charIndex,
      },
    });
  }
  
  // If no chunks were created (text is shorter than chunk size), create one chunk
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      content: text.trim(),
      metadata: {
        chunkIndex: 0,
        startChar: 0,
        endChar: text.length,
      },
    });
  }
  
  // Filter out any empty chunks that might have been created
  return chunks.filter(chunk => chunk.content.trim().length > 0);
}
