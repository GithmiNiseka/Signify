import React, { useState, useEffect } from 'react';
import { initializeSpeechRecognition, startListening } from '../../utils/speechToText';
import styles from './styles.module.css';

const VoiceInput = ({ onTranscript, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const rec = await initializeSpeechRecognition();
        setRecognition(rec);
      } catch (err) {
        setError(err.message);
      }
    };
    
    init();
    
    return () => {
      if (recognition) {
        recognition.abort();
      }
    };
  }, []);

  const handleListen = async () => {
    if (!recognition || disabled) return;
    
    setIsListening(true);
    setError(null);
    
    try {
      const transcript = await startListening(recognition);
      onTranscript(transcript);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsListening(false);
    }
  };

  return (
    <div className={styles.container}>
      <button
        onClick={handleListen}
        disabled={!recognition || disabled}
        className={`${styles.button} ${isListening ? styles.listening : ''}`}
      >
        {isListening ? (
          <span className={styles.pulse}>🎤 Listening...</span>
        ) : (
          '🎤 Speak'
        )}
      </button>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

// Make sure to export as default
export default VoiceInput;