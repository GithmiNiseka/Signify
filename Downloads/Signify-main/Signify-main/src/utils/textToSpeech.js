export const speakText = (text, language = 'si-LK') => {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Text-to-speech not supported'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;

    // Find Sinhala voice if available
    const voices = window.speechSynthesis.getVoices();
    const sinhalaVoice = voices.find(voice => 
      voice.lang === language || voice.lang.startsWith('si-')
    );

    if (sinhalaVoice) {
      utterance.voice = sinhalaVoice;
    }

    utterance.onend = resolve;
    utterance.onerror = (event) => {
      reject(new Error(`Speech error: ${event.error}`));
    };

    window.speechSynthesis.speak(utterance);
  });
};

// Preload voices
export const loadVoices = () => {
  return new Promise((resolve) => {
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
    
    if (window.speechSynthesis.getVoices().length > 0) {
      resolve(window.speechSynthesis.getVoices());
    }
  });
};