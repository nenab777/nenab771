import express from 'express';
import path from 'path';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import PDFParser from 'pdf2json';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 5500;

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle file upload and generate MCQs
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('Processing file:', req.file.originalname);

    try {
        // Initialize PDF parser with extended options
        const pdfParser = new PDFParser(null, {
            skipHidden: false,        // Don't skip any text
            includeHiddenText: true,  // Include hidden text layers
            useAdvancedParsing: true  // Use advanced text parsing
        });
        
        const extractedText = await new Promise((resolve, reject) => {
            pdfParser.on('pdfParser_dataReady', (pdfData) => {
                try {
                    let documentText = [];
                    
                    pdfData.Pages.forEach((page, pageIndex) => {
                        console.log(`Processing page ${pageIndex + 1}`);
                        let pageTexts = [];
                        
                        // Group text elements by their vertical position
                        const textGroups = new Map();
                        
                        page.Texts.forEach(textItem => {
                            if (textItem.R && textItem.R.length > 0) {
                                // Round y position to group nearby text
                                const yPos = Math.round(textItem.y * 10);
                                if (!textGroups.has(yPos)) {
                                    textGroups.set(yPos, []);
                                }
                                textGroups.get(yPos).push(textItem);
                            }
                        });

                        // Sort text groups by vertical position
                        const sortedYPositions = Array.from(textGroups.keys()).sort((a, b) => a - b);
                        
                        sortedYPositions.forEach(yPos => {
                            const lineTexts = textGroups.get(yPos)
                                // Sort text elements horizontally within each line
                                .sort((a, b) => a.x - b.x)
                                .map(textItem => {
                                    return textItem.R.map(r => {
                                        try {
                                            return decodeURIComponent(r.T)
                                                .replace(/\+/g, ' ')
                                                .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between merged words
                                                .replace(/\s+/g, ' ')
                                                .trim();
                                        } catch (e) {
                                            return r.T;
                                        }
                                    }).join('');
                                })
                                .filter(text => text.trim().length > 0);

                            // Add proper spacing between text elements
                            const lineText = lineTexts.join(' ');
                            if (lineText.trim()) {
                                pageTexts.push(lineText);
                            }
                        });

                        // Process page text with proper formatting
                        const pageContent = pageTexts
                            .join('\n')
                            .replace(/(?<=[.!?])\s+/g, '\n') // Add newline after sentences
                            .replace(/\n{3,}/g, '\n\n')      // Normalize paragraph spacing
                            .trim();

                        if (pageContent) {
                            documentText.push(pageContent);
                        }
                    });

                    const fullText = documentText
                        .join('\n\n')
                        .replace(/\s+/g, ' ')
                        .trim();

                    console.log(`Total pages processed: ${pdfData.Pages.length}`);
                    console.log('Text content length:', fullText.length);
                    console.log('Sample text:', fullText.substring(0, 300));

                    if (fullText.length < 50) {
                        reject(new Error('Insufficient text content extracted from PDF'));
                        return;
                    }

                    resolve(fullText);
                } catch (err) {
                    console.error('Text extraction error:', err);
                    reject(new Error('Failed to process PDF content: ' + err.message));
                }
            });

            pdfParser.on('pdfParser_dataError', error => {
                console.error('PDF parsing error:', error);
                reject(new Error('Failed to parse PDF file. The file may be corrupted or password protected.'));
            });

            // Load PDF file
            try {
                console.log('Reading PDF file:', req.file.path);
                const pdfBuffer = fs.readFileSync(req.file.path);
                pdfParser.parseBuffer(pdfBuffer);
            } catch (err) {
                console.error('File read error:', err);
                reject(new Error('Failed to read PDF file: ' + err.message));
            }
        });

        // Send response
        res.json({
            message: 'PDF processed successfully',
            text: extractedText,
            textLength: extractedText.length
        });

    } catch (err) {
        console.error('PDF processing error:', err);
        res.status(500).json({
            message: 'Error processing PDF',
            error: err.message,
            details: 'Please ensure the PDF contains text content and is not password protected.'
        });
    } finally {
        // Cleanup
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
