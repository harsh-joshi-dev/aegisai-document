import { useState, useEffect, useRef } from 'react';
import { supportedLanguages, getLanguageName } from '../utils/language';
import { API_BASE_URL } from '../api/client';
import './DocumentExplanationModal.css';

interface DocumentExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  explanation: string;
  riskLevel: 'Critical' | 'Warning' | 'Normal';
  riskCategory?: string;
  language?: string;
}

export default function DocumentExplanationModal({
  isOpen,
  onClose,
  documentName,
  explanation,
  riskLevel,
  riskCategory,
  language = 'en',
}: DocumentExplanationModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [words, setWords] = useState<string[]>([]);
  const [translatedExplanation, setTranslatedExplanation] = useState(explanation);
  const [isTranslating, setIsTranslating] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const highlightIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  // Split explanation into words for highlighting (preserve spaces and punctuation)
  useEffect(() => {
    if (translatedExplanation) {
      // Split by word boundaries but keep spaces and punctuation
      const wordArray = translatedExplanation.split(/(\s+)/).filter(w => w.length > 0);
      setWords(wordArray);
    }
  }, [translatedExplanation]);

  // Translate explanation when language changes
  useEffect(() => {
    // Stop any playing speech when language changes
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentWordIndex(-1);
      if (highlightIntervalRef.current) {
        clearTimeout(highlightIntervalRef.current);
        highlightIntervalRef.current = null;
      }
    }

    if (selectedLanguage !== 'en' && explanation) {
      translateExplanation(explanation, selectedLanguage);
    } else {
      setTranslatedExplanation(explanation);
    }
  }, [selectedLanguage, explanation]);

  const translateExplanation = async (text: string, targetLang: string) => {
    setIsTranslating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`.replace(/([^:])\/+/g, '$1/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text,
          targetLanguage: targetLang,
        }),
      });
      const data = await response.json();
      if (data.success && data.translatedText) {
        setTranslatedExplanation(data.translatedText);
      } else {
        setTranslatedExplanation(text); // Fallback to original
      }
    } catch (error) {
      console.error('Translation error:', error);
      setTranslatedExplanation(text); // Fallback to original
    } finally {
      setIsTranslating(false);
    }
  };

  // Map language codes to speech synthesis language codes
  const getSpeechLanguageCode = (langCode: string): string => {
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'hi': 'hi-IN',
      'gu': 'gu-IN',
    };
    return languageMap[langCode] || langCode;
  };

  const handlePlay = async () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in your browser.');
      return;
    }

    // Stop any existing speech
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentWordIndex(-1);
      // Clear any highlighting intervals/timeouts
      if (highlightIntervalRef.current) {
        clearTimeout(highlightIntervalRef.current);
        highlightIntervalRef.current = null;
      }
      return;
    }

    // If translation is in progress, wait for it
    if (isTranslating) {
      alert('Please wait for translation to complete.');
      return;
    }

    // Ensure we have translated text
    if (!translatedExplanation) {
      alert('No text available to speak.');
      return;
    }

    // Create new utterance with translated text
    const utterance = new SpeechSynthesisUtterance(translatedExplanation);
    const speechLangCode = getSpeechLanguageCode(selectedLanguage);
    utterance.lang = speechLangCode;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Get available voices for the selected language
    // Wait for voices to load if needed
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Voices might not be loaded yet, wait for them
      await new Promise<void>((resolve) => {
        const checkVoices = () => {
          voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            resolve();
          } else {
            setTimeout(checkVoices, 100);
          }
        };
        checkVoices();
        window.speechSynthesis.onvoiceschanged = checkVoices;
      });
    }

    const langCode = selectedLanguage.split('-')[0];

    // Try to find a voice that matches the language (prioritize exact match)
    let preferredVoice = voices.find(
      v => {
        const voiceLang = v.lang.toLowerCase();
        const targetLang = speechLangCode.toLowerCase();
        return voiceLang === targetLang || voiceLang.startsWith(targetLang);
      }
    );

    // Fallback: try to find any voice with the language code
    if (!preferredVoice) {
      preferredVoice = voices.find(v => {
        const voiceLang = v.lang.toLowerCase();
        return voiceLang.includes(langCode.toLowerCase()) || voiceLang.startsWith(langCode);
      });
    }

    // For Gujarati specifically, try alternative codes
    if (!preferredVoice && selectedLanguage === 'gu') {
      preferredVoice = voices.find(v => {
        const voiceLang = v.lang.toLowerCase();
        return voiceLang.includes('gujarati') || voiceLang.includes('gu-') || voiceLang.includes('-gu');
      });
    }

    // Final fallback: use default voice but log warning
    if (!preferredVoice) {
      console.warn(`No voice found for language ${speechLangCode}, using default`);
      preferredVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    }

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      console.log(`Using voice: ${preferredVoice.name} (${preferredVoice.lang}) for ${speechLangCode}`);
    } else {
      console.warn('No voice available, speech may not work correctly');
    }

    // Calculate timing based on actual speech rate and text length
    // Use utterance rate (0.9) and calculate based on characters per second
    const speechRate = utterance.rate || 0.9;
    const charsPerSecond = (speechRate * 150) / 60; // Approximate characters per second
    const avgCharsPerWord = 5; // Average characters per word (including spaces)
    const msPerWord = (avgCharsPerWord / charsPerSecond) * 1000;

    // Track speech start time for better synchronization
    let speechStartTime = 0;
    // let lastWordTime = 0;
    // const wordChars = words[wordIndex].length;

    utterance.onstart = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      setCurrentWordIndex(-1);
      speechStartTime = Date.now();
      // lastWordTime = speechStartTime;

      // Calculate cumulative character positions for each word
      const wordPositions: number[] = [];
      let charCount = 0;
      words.forEach((word) => {
        wordPositions.push(charCount);
        charCount += word.length;
      });

      // Start highlighting with more accurate timing
      let wordIndex = 0;

      const highlightNextWord = () => {
        // Check if still playing
        if (!isPlayingRef.current) {
          if (highlightIntervalRef.current) {
            clearTimeout(highlightIntervalRef.current);
            highlightIntervalRef.current = null;
          }
          return;
        }

        if (wordIndex < words.length) {
          // Skip highlighting spaces
          while (wordIndex < words.length && words[wordIndex].trim().length === 0) {
            wordIndex++;
          }

          if (wordIndex < words.length) {
            const currentTime = Date.now();
            const elapsed = currentTime - speechStartTime;

            // Calculate expected time for this word based on character position
            // const wordChars = words[wordIndex].length;
            const expectedTime = (wordPositions[wordIndex] / charsPerSecond) * 1000;

            // Adjust timing dynamically based on actual vs expected
            const timeAdjustment = elapsed - expectedTime;
            const adjustedMsPerWord = Math.max(100, Math.min(500, msPerWord + (timeAdjustment / 10)));

            // Update highlighted word
            setCurrentWordIndex(wordIndex);

            // Scroll to highlighted word smoothly
            requestAnimationFrame(() => {
              const wordElement = wordsRef.current?.children[wordIndex] as HTMLElement;
              if (wordElement) {
                const container = wordsRef.current;
                if (container) {
                  const elementTop = wordElement.offsetTop;
                  const elementHeight = wordElement.offsetHeight;
                  const containerHeight = container.clientHeight;
                  const scrollTop = container.scrollTop;

                  // Only scroll if element is not fully visible
                  const isVisible = elementTop >= scrollTop &&
                    (elementTop + elementHeight) <= (scrollTop + containerHeight);

                  if (!isVisible) {
                    wordElement.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                      inline: 'nearest'
                    });
                  }
                }
              }
            });

            wordIndex++;
            // lastWordTime = currentTime;

            // Schedule next word highlight with adjusted timing
            if (wordIndex < words.length) {
              highlightIntervalRef.current = setTimeout(highlightNextWord, adjustedMsPerWord) as any;
            } else {
              // Done highlighting
              if (highlightIntervalRef.current) {
                clearInterval(highlightIntervalRef.current);
                highlightIntervalRef.current = null;
              }
            }
          }
        }
      };

      // Start highlighting after a small delay to sync with speech
      highlightIntervalRef.current = setTimeout(highlightNextWord, Math.max(100, msPerWord * 0.5)) as any;
    };

    utterance.onend = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentWordIndex(-1);
      // Clear highlighting interval
      if (highlightIntervalRef.current) {
        clearTimeout(highlightIntervalRef.current);
        highlightIntervalRef.current = null;
      }
    };

    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentWordIndex(-1);
      // Clear highlighting interval
      if (highlightIntervalRef.current) {
        clearTimeout(highlightIntervalRef.current);
        highlightIntervalRef.current = null;
      }
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Load voices when component mounts
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Chrome loads voices asynchronously
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // Voices loaded
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (highlightIntervalRef.current) {
        clearTimeout(highlightIntervalRef.current);
        highlightIntervalRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'Critical':
        return 'risk-critical';
      case 'Warning':
        return 'risk-warning';
      default:
        return 'risk-normal';
    }
  };

  return (
    <div className="explanation-modal-overlay" onClick={onClose}>
      <div className="explanation-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="explanation-modal-header">
          <div className="explanation-header-info">
            <h2>📄 Document Explanation</h2>
            <p className="document-name">{documentName}</p>
            {riskCategory && riskCategory !== 'None' && (
              <span className={`risk-badge ${getRiskBadgeClass(riskLevel)}`}>
                {riskLevel} - {riskCategory}
              </span>
            )}
          </div>
          <button className="explanation-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="explanation-controls">
          <div className="language-selector">
            <select
              id="explanation-language"
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                if (isPlaying) {
                  window.speechSynthesis.cancel();
                  setIsPlaying(false);
                }
              }}
              disabled={isTranslating}
            >
              {supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </option>
              ))}
            </select>
          </div>

          <button
            className={`play-button ${isPlaying ? 'playing' : ''}`}
            onClick={handlePlay}
            disabled={isTranslating || !translatedExplanation}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play Explanation'}
          </button>
        </div>

        {isTranslating && (
          <div className="translating-indicator">
            <div className="spinner"></div>
            <span>Translating to {getLanguageName(selectedLanguage)}...</span>
          </div>
        )}

        <div className="explanation-text-container" ref={wordsRef}>
          {words.map((word, index) => {
            // Don't highlight spaces
            const isSpace = word.trim().length === 0;
            return (
              <span
                key={index}
                className={`explanation-word ${!isSpace && index === currentWordIndex ? 'highlighted' : ''}`}
              >
                {word}
              </span>
            );
          })}
        </div>

        <div className="explanation-footer">
          <p className="explanation-hint">
            💡 This explanation helps you understand what this document means and what actions you should take.
          </p>
        </div>
      </div>
    </div>
  );
}
