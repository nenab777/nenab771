import { API_KEY } from './config.js';

// Use the global PDFLib object provided by the CDN
const { PDFDocument } = PDFLib;

class MCQApp {
    constructor() {
        this.pdfInput = document.getElementById('pdfInput');
        this.generateMCQsBtn = document.getElementById('generateMCQsBtn');
        this.errorContainer = document.getElementById('errorContainer');
        this.loadingAnimation = document.getElementById('loadingAnimation');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.fileNameDisplay = document.getElementById('fileName');
        this.mcqContainer = document.getElementById('mcqContainer');
        this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        this.apiKey = 'AIzaSyDmscAOm-kQBQOaIuCLVB5Urdn4ql-5Yu8';
        this.selectedDifficulty = null;
        this.basePath = '/nenab771';
        this.bindPDFEvents();
        this.bindDifficultyEvents();
        this.getArabicMotivationalMessage();
    }

    bindPDFEvents() {
        this.pdfInput.addEventListener('change', () => this.handleFileSelection());
        this.generateMCQsBtn.addEventListener('click', () => this.handlePDFUpload());
    }

    bindDifficultyEvents() {
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedDifficulty = btn.dataset.difficulty;
                this.generateMCQsBtn.disabled = !this.pdfInput.files[0] || !this.selectedDifficulty;
            });
        });
    }

    handleFileSelection() {
        const file = this.pdfInput.files[0];
        if (file) {
            console.log('File selected:', file.name);
            this.fileNameDisplay.textContent = `Selected File: ${file.name}`;
            this.uploadProgress.style.display = 'block';
            this.uploadProgress.value = 0; // Reset progress bar
            this.generateMCQsBtn.disabled = false; // Enable the button after file selection
        } else {
            console.log('No file selected.');
            this.fileNameDisplay.textContent = '';
            this.uploadProgress.style.display = 'none';
            this.generateMCQsBtn.disabled = true; // Disable the button if no file is selected
        }
    }

    async handlePDFUpload() {
        const file = this.pdfInput.files[0];
        if (!file) {
            this.showError('Please upload a PDF file.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showError('File size too large. Please upload a smaller PDF.');
            return;
        }

        this.loadingAnimation.style.display = 'block';
        this.uploadProgress.style.display = 'block';
        this.generateMCQsBtn.disabled = true;
        this.generateMCQsBtn.textContent = 'Processing PDF...';

        try {
            // Read PDF client-side using PDF.js
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let extractedText = '';

            // Extract text from all pages
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                extractedText += pageText + '\n';
            }

            if (!extractedText || extractedText.trim().length < 10) {
                throw new Error('Not enough text content in the PDF');
            }

            console.log('Extracted text length:', extractedText.length);
            this.generateMCQsBtn.textContent = 'Generating MCQs...';
            await this.generateMCQs(extractedText);

        } catch (error) {
            console.error('Processing Error:', error);
            this.showError(error.message);
        } finally {
            this.loadingAnimation.style.display = 'none';
            this.uploadProgress.style.display = 'none';
            this.generateMCQsBtn.disabled = false;
            this.generateMCQsBtn.textContent = 'Generate MCQs';
        }
    }

    async generateMCQs(text) {
        const difficultyPrompts = {
            'easy': 'Generate 10 basic multiple choice questions suitable for beginners.',
            'medium': 'Generate 10 intermediate level multiple choice questions with moderate complexity.',
            'hard': 'Generate 10 challenging multiple choice questions requiring deep understanding.',
            'very-hard': 'Generate 10 expert-level multiple choice questions with complex concepts and critical thinking.'
        };

        try {
            if (!this.selectedDifficulty) {
                throw new Error('Please select a difficulty level');
            }

            const prompt = `${difficultyPrompts[this.selectedDifficulty]} Return only a JSON array in this format, with no other text or markdown: [{"question": "question text", "options": ["correct answer", "wrong1", "wrong2", "wrong3"]}]. Text to process: ${text}`;

            const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('API Error:', error);
                throw new Error(`Failed to generate MCQs: ${error.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            // Clean up the response text and extract JSON
            const rawText = data.candidates[0].content.parts[0].text;
            const jsonStr = rawText.replace(/```json\s*|\s*```/g, '')
                                 .replace(/^\s*\[/, '[')
                                 .trim();

            const mcqs = JSON.parse(jsonStr);
            if (!Array.isArray(mcqs)) {
                throw new Error('Response is not in the expected format');
            }

            // Store MCQs in localStorage
            localStorage.setItem('mcqs', JSON.stringify(mcqs));

            // Redirect to MCQ page
            window.location.href = `${this.basePath}/mcq.html`;

        } catch (error) {
            console.error('MCQ Generation Error:', error);
            this.showError('Failed to generate MCQs: ' + error.message);
        }
    }

    async getArabicMotivationalMessage() {
        try {
            const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Generate a short romantic message in Arabic (max 15 words) between "نينب (نوني)" and his beloved "جيجي (نجمة)" who is a civil engineer. Make it sweet and encouraging. Return only the Arabic text.`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate message');
            }

            const data = await response.json();
            const message = data.candidates[0].content.parts[0].text.trim();
            
            const messageElement = document.getElementById('motivationalMessage');
            if (messageElement) {
                messageElement.style.direction = 'rtl'; // Set text direction for Arabic
                messageElement.textContent = message + ' ✨';
            }
        } catch (error) {
            console.error('Failed to generate motivational message:', error);
            const fallbackMessages = [
                "من نوني لنجمتي جيجي: أنتِ مهندستي المبدعة ونور حياتي ❤️",
                "نجمتي جيجي، إبداعك وذكاؤك يلهمني كل يوم 🌟",
                "من نينب: يا نجمة، أنتِ فخر قلبي يا مهندستي الجميلة ✨",
                "نجمة وﻧﻮﻧﻲ، قصة حب لا تنتهي 💝",
                "جيجي حبيبتي، أنتِ أجمل نجمة في سماء حياتي ⭐"
            ];
            const messageElement = document.getElementById('motivationalMessage');
            if (messageElement) {
                messageElement.style.direction = 'rtl';
                messageElement.textContent = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
            }
        }
    }

    showError(message) {
        console.error('Error:', message);
        this.errorContainer.textContent = message;
        this.errorContainer.style.display = 'block';
        setTimeout(() => {
            this.errorContainer.style.display = 'none';
        }, 5000);
    }
}

new MCQApp();
