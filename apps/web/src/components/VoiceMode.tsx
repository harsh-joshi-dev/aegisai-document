import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../api/client';
import { useLocation } from '../contexts/LocationContext';
import './VoiceMode.css';

interface VoiceModeProps {
  isOpen: boolean;
  onClose: () => void;
  documentIds: string[];
}

export default function VoiceMode({ isOpen, onClose, documentIds }: VoiceModeProps) {
  const { location: userLocation } = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continuousMode, setContinuousMode] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ question: string; answer: string; timestamp: Date }>>([]);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      stopListening();
      stopSpeaking();
      setTranscript('');
      setAnswer(null);
      setError(null);
      setIsSpeaking(false);
      finalTranscriptRef.current = '';
    }
  }, [isOpen]);

  useEffect(() => {
    // Scroll to bottom when new message is added
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, answer]);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        finalTranscriptRef.current = finalTranscript.trim();
        setTranscript(finalTranscriptRef.current);
        // Stop recognition when we have final transcript
        recognition.stop();
      } else {
        setTranscript(interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Please allow microphone access.');
      } else {
        setError('Speech recognition error. Please try again.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Process the final transcript if we have one
      const finalTranscript = finalTranscriptRef.current.trim();
      if (finalTranscript) {
        handleVoiceQuery(finalTranscript);
        finalTranscriptRef.current = ''; // Reset for next time
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleVoiceQuery = async (question: string) => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      // Use the regular chat API for conversational responses
      const response = await sendChatMessage({
        question: question.trim(),
        language: 'en',
        topK: 5,
        documentIds: documentIds.length > 0 ? documentIds : undefined,
        userLocation: userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        } : undefined,
      });

      if (response.answer) {
        setAnswer(response.answer);
        // Add to conversation history
        setConversationHistory(prev => [...prev, {
          question: question.trim(),
          answer: response.answer,
          timestamp: new Date()
        }]);
        // Clear current transcript and answer for next question
        setTranscript('');
        setAnswer(null);
        // Automatically speak the answer
        speakAnswer(response.answer);
      } else {
        setError('No response received from AI');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to process your question. Please try again.';
      setError(errorMsg);
      console.error('Voice query error:', err);
    } finally {
      setLoading(false);
    }
  };

  const speakAnswer = (text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Stop any ongoing speech
    stopSpeaking();

    // Wait for voices to be loaded
    const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
      return new Promise((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          resolve(voices);
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            resolve(window.speechSynthesis.getVoices());
          };
          // Fallback timeout
          setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
        }
      });
    };

    loadVoices().then((voices) => {
      // Filter English voices
      const englishVoices = voices.filter(voice => 
        voice.lang.startsWith('en')
      );

      if (englishVoices.length === 0) {
        console.warn('No English voices found');
        // Fallback to default
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
        return;
      }

      // Priority order for best voices:
      // 1. Google voices (usually best quality)
      // 2. Microsoft voices (good quality)
      // 3. Natural-sounding names (Samantha, Alex, Karen, etc.)
      // 4. Cloud-based voices (localService === false)
      // 5. en-US voices
      // 6. Any English voice
      
      let selectedVoice = 
        englishVoices.find(voice => 
          voice.name.toLowerCase().includes('google') && 
          (voice.name.toLowerCase().includes('us') || voice.lang === 'en-US')
        ) ||
        englishVoices.find(voice => 
          voice.name.toLowerCase().includes('google')
        ) ||
        englishVoices.find(voice => 
          voice.name.toLowerCase().includes('microsoft') && 
          (voice.name.toLowerCase().includes('us') || voice.lang === 'en-US')
        ) ||
        englishVoices.find(voice => 
          voice.name.toLowerCase().includes('microsoft')
        ) ||
        englishVoices.find(voice => 
          ['samantha', 'alex', 'karen', 'daniel', 'victoria', 'susan'].some(name => 
            voice.name.toLowerCase().includes(name)
          )
        ) ||
        englishVoices.find(voice => 
          !voice.localService && voice.lang === 'en-US'
        ) ||
        englishVoices.find(voice => 
          voice.lang === 'en-US'
        ) ||
        englishVoices[0]; // Fallback to first English voice

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Use the selected voice
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
        console.log('Using voice:', selectedVoice.name, selectedVoice.lang);
      } else {
        utterance.lang = 'en-US';
      }

      // Optimize speech settings for natural, clear sound
      utterance.rate = 1.0; // Normal speed (1.0 = 100% speed)
      utterance.pitch = 1.0; // Normal pitch (1.0 = normal)
      utterance.volume = 1.0; // Full volume

      utterance.onend = () => {
        synthesisRef.current = null;
        setIsSpeaking(false);
        // If continuous mode is enabled, automatically start listening again
        if (continuousMode && isOpen) {
          setTimeout(() => {
            if (!isListening && !loading) {
              startListening();
            }
          }, 500); // Small delay before starting to listen again
        }
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        synthesisRef.current = null;
      };

      setIsSpeaking(true);
      synthesisRef.current = window.speechSynthesis;
      window.speechSynthesis.speak(utterance);
    });
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    synthesisRef.current = null;
    setIsSpeaking(false);
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="voice-mode-overlay" onClick={onClose}>
      <div className="voice-mode-container" onClick={(e) => e.stopPropagation()}>
        <div className="voice-mode-header">
          <div className="voice-header-content">
            <svg className="voice-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Voice-First Mode</h2>
          </div>
          <button className="voice-mode-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="voice-mode-content">
          <div className="voice-mode-info">
            <p>Press the microphone button and ask any question. The AI will answer you like a human conversation.</p>
          </div>

          <div className="voice-controls">
            <button
              className={`mic-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
              onClick={handleMicClick}
              disabled={loading || isSpeaking}
            >
              {isListening ? (
                <>
                  <svg className="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="6" width="12" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Listening...</span>
                </>
              ) : isSpeaking ? (
                <>
                  <svg className="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Speaking...</span>
                </>
              ) : (
                <>
                  <svg className="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Press to Speak</span>
                </>
              )}
            </button>
          </div>

          <div className="continuous-mode-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="toggle-input"
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">Continuous Conversation</span>
            </label>
            <p className="toggle-hint">Automatically listen for your next question after AI responds</p>
          </div>

          {transcript && !loading && (
            <div className="transcript-section">
              <h4>You said:</h4>
              <div className="transcript-text">{transcript}</div>
            </div>
          )}

          {loading && (
            <div className="voice-loading">
              <div className="loading-spinner"></div>
              <p>Processing your question...</p>
            </div>
          )}

          {error && (
            <div className="voice-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          {conversationHistory.length > 0 && (
            <div className="conversation-history">
              <h4 className="conversation-title">Conversation History</h4>
              <div className="conversation-list">
                {conversationHistory.map((item, index) => (
                  <div key={index} className="conversation-item">
                    <div className="conversation-question">
                      <div className="conversation-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        You said:
                      </div>
                      <div className="conversation-text">{item.question}</div>
                    </div>
                    <div className="conversation-answer">
                      <div className="conversation-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        AI Response:
                      </div>
                      <div className="conversation-text">{item.answer}</div>
                      <button
                        className="conversation-speak-button"
                        onClick={() => speakAnswer(item.answer)}
                        title="Listen to this answer"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Speak
                      </button>
                    </div>
                  </div>
                ))}
                <div ref={conversationEndRef} />
              </div>
            </div>
          )}

          {answer && conversationHistory.length === 0 && (
            <div className="voice-answer">
              <h4>AI Response:</h4>
              <div className="answer-text">{answer}</div>
              <div className="answer-actions">
                <button
                  className="speak-button"
                  onClick={() => speakAnswer(answer)}
                  title="Listen to the answer again"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Speak Again
                </button>
                <button
                  className="stop-speak-button"
                  onClick={stopSpeaking}
                  title="Stop speaking"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="4" width="4" height="16" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="14" y="4" width="4" height="16" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Stop
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
