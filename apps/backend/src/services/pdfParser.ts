import pdfParse from 'pdf-parse';

export interface ParsedPDF {
  text: string;
  numPages: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
  };
  warnings?: string[];
}

// Helper function to sanitize text for PostgreSQL UTF-8 encoding
function sanitizeText(text: string): string {
  // Remove null bytes and other invalid UTF-8 sequences
  return text
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove other control characters
    .trim();
}

// Try to repair corrupted PDF by attempting different parsing strategies
async function tryRepairPDF(buffer: Buffer): Promise<any> {
  // Strategy 1: Try with max buffer size
  try {
    return await pdfParse(buffer, { max: 0 }); // 0 = no limit
  } catch (e1) {
    // Strategy 2: Try with version option
    try {
      return await pdfParse(buffer, { version: '1.4.0' });
    } catch (e2) {
      // Strategy 3: Try with different options
      try {
        return await pdfParse(buffer, { 
          max: 0,
          version: '1.4.0',
        });
      } catch (e3) {
        throw new Error(`All PDF parsing strategies failed. Last error: ${e3 instanceof Error ? e3.message : 'Unknown'}`);
      }
    }
  }
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const warnings: string[] = [];
  
  // Validate buffer
  if (!buffer || buffer.length === 0) {
    throw new Error('PDF buffer is empty or invalid');
  }
  
  // Check if it looks like a PDF (basic header check)
  const header = buffer.slice(0, 4).toString();
  if (header !== '%PDF') {
    throw new Error('File does not appear to be a valid PDF (missing PDF header)');
  }
  
  try {
    // Try normal parsing first
    let data;
    try {
      data = await pdfParse(buffer);
    } catch (error: any) {
      // If parsing fails with XRef or similar errors, try repair strategies
      if (error.message?.includes('XRef') || 
          error.message?.includes('bad') || 
          error.message?.includes('corrupt') ||
          error.message?.includes('invalid')) {
        warnings.push('PDF appears corrupted, attempting repair...');
        console.warn('PDF parsing error, attempting repair:', error.message);
        data = await tryRepairPDF(buffer);
        warnings.push('PDF repair successful');
      } else {
        throw error;
      }
    }
    
    // Sanitize text to remove invalid UTF-8 sequences
    let sanitizedText = sanitizeText(data.text || '');
    
    // Check if we got any text
    if (!sanitizedText || sanitizedText.length === 0) {
      // Check if PDF has pages (might be image-only)
      if (data.numpages > 0) {
        warnings.push('PDF contains pages but no extractable text. This may be an image-only PDF. OCR is not available in this version.');
        throw new Error('No text content found in PDF. The PDF may contain only images without extractable text. Please use a PDF with selectable text or convert images to text first.');
      } else {
        throw new Error('PDF appears to be empty or corrupted');
      }
    }
    
    // Check for very short text (might indicate extraction issues)
    if (sanitizedText.length < 50 && data.numpages > 1) {
      warnings.push('Extracted text is very short for a multi-page document. Some content may be missing.');
    }
    
    return {
      text: sanitizedText,
      numPages: data.numpages || 1,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    // Provide more helpful error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('XRef') || errorMessage.includes('bad XRef')) {
      throw new Error(`PDF is corrupted (XRef table error). This usually means the PDF file is damaged. Try: 1) Re-saving the PDF from the original source, 2) Using a PDF repair tool, or 3) Converting to a new PDF. Original error: ${errorMessage}`);
    }
    
    if (errorMessage.includes('No text content')) {
      throw error; // Re-throw our custom message
    }
    
    if (errorMessage.includes('empty') || errorMessage.includes('corrupted')) {
      throw new Error(`PDF appears to be empty or corrupted. Please verify the file is a valid PDF. Error: ${errorMessage}`);
    }
    
    // Generic error with helpful context
    throw new Error(`Failed to parse PDF: ${errorMessage}. The PDF may be corrupted, password-protected, or in an unsupported format.`);
  }
}
