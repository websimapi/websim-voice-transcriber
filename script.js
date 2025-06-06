class VoiceTranscriber {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        
        this.recordBtn = document.getElementById('recordBtn');
        this.transcript = document.getElementById('transcript');
        this.statusText = document.getElementById('statusText');
        this.clearBtn = document.getElementById('clearBtn');
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        
        this.init();
    }
    
    init() {
        this.checkBrowserSupport();
        this.setupEventListeners();
        this.setupSpeechRecognition();
    }
    
    checkBrowserSupport() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
            this.recordBtn.disabled = true;
            return false;
        }
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Microphone access not supported in this browser');
            this.recordBtn.disabled = true;
            return false;
        }
        
        return true;
    }
    
    setupEventListeners() {
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.clearBtn.addEventListener('click', () => this.clearTranscript());
    }
    
    setupSpeechRecognition() {
        if (!this.checkBrowserSupport()) return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;
        
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.updateStatus('Listening...', true);
        };
        
        this.recognition.onresult = (event) => {
            console.log('Speech recognition result received');
            this.processResults(event);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            let errorMessage = 'Recognition error';
            
            switch(event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Try speaking louder.';
                    break;
                case 'audio-capture':
                    errorMessage = 'Microphone not accessible. Please check permissions.';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied. Please allow microphone access.';
                    break;
                case 'network':
                    errorMessage = 'Network error. Please check your connection.';
                    break;
                default:
                    errorMessage = `Recognition error: ${event.error}`;
            }
            
            this.showError(errorMessage);
            this.stopRecording();
        };
        
        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            if (this.isRecording) {
                console.log('Restarting speech recognition');
                // Small delay before restarting to prevent rapid restarts
                setTimeout(() => {
                    if (this.isRecording) {
                        this.recognition.start();
                    }
                }, 100);
            }
        };
    }
    
    async setupAudioVisualization() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 256;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            this.microphone.connect(this.analyser);
            this.startVisualization();
        } catch (error) {
            console.error('Error setting up audio visualization:', error);
        }
    }
    
    startVisualization() {
        const draw = () => {
            if (!this.isRecording) return;
            
            requestAnimationFrame(draw);
            
            this.analyser.getByteFrequencyData(this.dataArray);
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            const barWidth = (this.canvas.width / this.dataArray.length) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < this.dataArray.length; i++) {
                barHeight = (this.dataArray[i] / 255) * this.canvas.height * 0.8;
                
                const hue = (i / this.dataArray.length) * 360;
                this.ctx.fillStyle = `hsla(${hue}, 70%, 70%, 0.8)`;
                
                this.ctx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        
        draw();
    }
    
    processResults(event) {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        this.updateTranscript(finalTranscript, interimTranscript);
    }
    
    updateTranscript(finalText, interimText) {
        // Remove placeholder if it exists
        const placeholder = this.transcript.querySelector('.placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        
        // Add final text to transcript
        if (finalText.trim()) {
            const finalSpan = document.createElement('span');
            finalSpan.className = 'final-text';
            finalSpan.textContent = finalText;
            this.transcript.appendChild(finalSpan);
        }
        
        // Update or add interim text
        let interimSpan = this.transcript.querySelector('.interim-text');
        if (interimText.trim()) {
            if (!interimSpan) {
                interimSpan = document.createElement('span');
                interimSpan.className = 'interim-text';
                this.transcript.appendChild(interimSpan);
            }
            interimSpan.textContent = interimText;
        } else if (interimSpan) {
            interimSpan.remove();
        }
        
        // Auto-scroll to bottom
        this.transcript.scrollTop = this.transcript.scrollHeight;
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            // Request microphone permission first
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.isRecording = true;
            this.recordBtn.classList.add('recording');
            this.recordBtn.querySelector('.btn-text').textContent = 'Stop Recording';
            document.querySelector('.status-dot').classList.add('recording');
            
            await this.setupAudioVisualization();
            
            // Start speech recognition with error handling
            try {
                this.recognition.start();
                console.log('Starting speech recognition...');
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                throw new Error('Could not start speech recognition');
            }
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Could not start recording. Please check microphone permissions and try again.');
            this.stopRecording();
        }
    }
    
    stopRecording() {
        this.isRecording = false;
        this.recordBtn.classList.remove('recording');
        this.recordBtn.querySelector('.btn-text').textContent = 'Start Recording';
        document.querySelector('.status-dot').classList.remove('recording');
        
        if (this.recognition) {
            this.recognition.stop();
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.updateStatus('Ready to record', false);
        
        // Clear the canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    clearTranscript() {
        this.transcript.innerHTML = '<div class="placeholder">Your speech will appear here...</div>';
    }
    
    updateStatus(message, isRecording) {
        this.statusText.textContent = message;
        if (isRecording) {
            document.querySelector('.status-dot').classList.add('recording');
        } else {
            document.querySelector('.status-dot').classList.remove('recording');
        }
    }
    
    showError(message) {
        console.error('VoiceTranscriber Error:', message);
        this.updateStatus(`Error: ${message}`, false);
        
        // Show error in transcript area as well
        this.transcript.innerHTML = `<div class="error-message" style="color: #ff6b6b; text-align: center; margin-top: 50px;">${message}</div>`;
        
        setTimeout(() => {
            this.updateStatus('Ready to record', false);
            if (this.transcript.querySelector('.error-message')) {
                this.clearTranscript();
            }
        }, 5000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VoiceTranscriber();
});