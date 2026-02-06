import { parsePDF, ParsedPDF } from './pdfParser.js';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';
import { fromPath, fromBuffer } from 'pdf2pic';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ParsedDocument {
  text: string;
  numPages: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    fileType?: string;
  };
  warnings?: string[];
  isImageOnly?: boolean;
}

/**
 * Parse image with OCR (mobile scan uploads)
 */
async function parseImageWithOCR(buffer: Buffer, mimetype: string): Promise<ParsedDocument> {
  const warnings: string[] = [];

  if (!buffer || buffer.length === 0) {
    throw new Error('Image buffer is empty or invalid');
  }

  const ocrWorker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  try {
    const { data } = await ocrWorker.recognize(buffer);
    const text = (data?.text || '').trim();

    if (!text) {
      warnings.push('OCR produced no text. Ensure the photo is sharp with good lighting.');
    }

    return {
      text,
      numPages: 1,
      metadata: {
        fileType: 'image',
      },
      warnings,
      isImageOnly: true,
    };
  } finally {
    await ocrWorker.terminate();
  }
}

/**
 * Parse PDF with OCR fallback for image-only PDFs
 */
async function parsePDFWithOCR(buffer: Buffer): Promise<ParsedDocument> {
  try {
    // Try normal PDF parsing first
    const parsed = await parsePDF(buffer);
    return {
      ...parsed,
      metadata: {
        ...parsed.metadata,
        fileType: 'pdf',
      },
    };
  } catch (error: any) {
    // If no text found, try OCR
    if (error.message?.includes('No text content') || error.message?.includes('image-only')) {
      console.log('PDF appears to be image-only, attempting OCR...');
      
      try {
        // Convert PDF pages to images first, then use OCR
        console.log('Starting OCR for image-only PDF...');
        
        // Create temporary directory for images
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-ocr-'));
        const tempPdfPath = path.join(tempDir, 'document.pdf');
        
        try {
          // Write PDF buffer to temporary file
          fs.writeFileSync(tempPdfPath, buffer);
          
          // Convert PDF to images using pdf2pic
          const options = {
            density: 300,           // Higher DPI for better OCR accuracy
            saveFilename: 'page',
            savePath: tempDir,
            format: 'png',
            width: 2000,
            height: 2000,
          };
          
          const convert = fromBuffer(buffer, options);
          
          // Get number of pages (try to convert first page to get count)
          // pdf2pic doesn't provide page count directly, so we'll try pages until we get an error
          let numPages = 1;
          const maxPages = 100; // Safety limit
          const pageImages: string[] = [];
          
          // Try to convert pages
          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            try {
              const result = await convert(pageNum, { responseType: 'image' });
              if (result && result.path) {
                pageImages.push(result.path);
                numPages = pageNum;
                console.log(`Converted page ${pageNum} to image`);
              } else {
                break; // No more pages
              }
            } catch (pageError: any) {
              if (pageNum === 1) {
                throw pageError; // If first page fails, re-throw
              }
              break; // No more pages
            }
          }
          
          if (pageImages.length === 0) {
            throw new Error('Failed to convert PDF pages to images');
          }
          
          console.log(`PDF has ${numPages} page(s), performing OCR...`);
          
          // Initialize Tesseract worker
          const ocrWorker = await createWorker('eng', 1, {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
              }
            }
          });
          
          let allText = '';
          const warnings: string[] = [];
          
          // Process each page image
          for (let i = 0; i < pageImages.length; i++) {
            const pageNum = i + 1;
            const imagePath = pageImages[i];
            
            try {
              console.log(`Performing OCR on page ${pageNum}/${pageImages.length}...`);
              
              // Read image file
              const imageBuffer = fs.readFileSync(imagePath);
              
              // Perform OCR on the image
              const { data } = await ocrWorker.recognize(imageBuffer);
              
              if (data.text && data.text.trim().length > 0) {
                allText += `\n\n--- Page ${pageNum} ---\n\n${data.text}\n`;
                console.log(`Page ${pageNum}: Extracted ${data.text.length} characters`);
              } else {
                warnings.push(`Page ${pageNum}: No text extracted`);
              }
            } catch (pageError) {
              console.error(`Error processing page ${pageNum}:`, pageError);
              warnings.push(`Page ${pageNum}: Failed to process - ${pageError instanceof Error ? pageError.message : 'Unknown error'}`);
            }
          }
          
          await ocrWorker.terminate();
          
          if (allText.trim().length > 0) {
            console.log(`OCR extracted ${allText.length} total characters from ${numPages} page(s)`);
            return {
              text: allText.trim(),
              numPages: numPages,
              metadata: {
                fileType: 'pdf',
                creator: 'OCR (Tesseract)',
              },
              warnings: [
                'This PDF was processed using OCR. Text accuracy may vary.',
                ...warnings,
              ],
              isImageOnly: true,
            };
          } else {
            throw new Error('OCR did not extract any text from the PDF images.');
          }
        } finally {
          // Cleanup temporary files
          try {
            if (fs.existsSync(tempDir)) {
              fs.readdirSync(tempDir).forEach(file => {
                fs.unlinkSync(path.join(tempDir, file));
              });
              fs.rmdirSync(tempDir);
            }
          } catch (cleanupError) {
            console.warn('Failed to cleanup temporary files:', cleanupError);
          }
        }
      } catch (ocrError) {
        console.error('OCR error:', ocrError);
        
        // Provide more helpful error messages
        if (ocrError instanceof Error) {
          if (ocrError.message.includes('Pdf reading is not supported') || 
              ocrError.message.includes('Error attempting to read image') ||
              ocrError.message.includes('GraphicsMagick') ||
              ocrError.message.includes('ImageMagick')) {
            throw new Error('PDF contains only images. OCR processing requires GraphicsMagick or ImageMagick to be installed on the server. Please install one of these tools or use a PDF with selectable text.');
          }
        }
        
        throw new Error(`PDF contains only images and OCR failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}. Please ensure the PDF contains clear, readable images or install GraphicsMagick/ImageMagick.`);
      }
    }
    throw error;
  }
}

/**
 * Parse Word document (.docx)
 */
async function parseWord(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    return {
      text: result.value,
      numPages: Math.ceil(result.value.length / 2000), // Estimate pages
      metadata: {
        fileType: 'docx',
      },
      warnings: result.messages.length > 0 ? result.messages.map(m => m.message) : undefined,
    };
  } catch (error) {
    throw new Error(`Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse Excel document (.xls, .xlsx)
 */
async function parseExcel(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let allText = '';
    let sheetCount = 0;
    
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_csv(worksheet);
      allText += `\n\n--- Sheet: ${sheetName} ---\n\n${sheetData}`;
      sheetCount++;
    });
    
    return {
      text: allText.trim(),
      numPages: sheetCount,
      metadata: {
        fileType: 'xlsx',
        title: workbook.Props?.Title,
        author: workbook.Props?.Author,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse Excel document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main document parser - routes to appropriate parser based on file type
 */
export async function parseDocument(
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<ParsedDocument> {
  // Determine file type from mimetype or filename
  const fileType = mimetype || getFileTypeFromFilename(filename);
  
  switch (fileType) {
    case 'application/pdf':
    case 'pdf':
      return await parsePDFWithOCR(buffer);

    case 'image/png':
    case 'image/jpeg':
    case 'image/jpg':
    case 'image/webp':
    case 'png':
    case 'jpeg':
    case 'jpg':
    case 'webp':
      return await parseImageWithOCR(buffer, mimetype);
    
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
    case 'docx':
    case 'doc':
      return await parseWord(buffer);
    
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
    case 'xlsx':
    case 'xls':
      return await parseExcel(buffer);
    
    default:
      throw new Error(`Unsupported file type: ${fileType}. Supported types: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, WEBP`);
  }
}

/**
 * Get file type from filename extension
 */
function getFileTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const typeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return typeMap[ext] || ext;
}

/**
 * Check if file type is supported
 */
export function isSupportedFileType(mimetype: string, filename: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
  ];
  
  if (supportedTypes.includes(mimetype)) {
    return true;
  }
  
  // Check by extension
  const ext = filename.toLowerCase().split('.').pop() || '';
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp'].includes(ext);
}
