import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

export const GEMINI_API_KEY = 'AIzaSyC-FN_icIcRzJvxOo0bsVSb5FRgUv_2fT0';
export const GEMINI_MODEL = 'gemini-1.5-flash-latest';
export const GCP_SPEECH_API_KEY = 'AIzaSyDjJEpJDySxZH5vZh-lrjLhPuxzI5nI_lk';

// Sign language image mapping
const signLanguageMap = {
  "ආයුබෝවන්": "/signs/ayubowan.jpg",
  "ස්තූතියි": "/signs/sthuthiyi.jpg",
  "කොහොමද": "/signs/kohomada.jpg",
  "මම": "/signs/mama.jpg",
  "ඔයා": "/signs/oyaata.jpg",
  "නම": "/signs/nam.jpg",
  "හොඳින්": "/signs/hodin.jpg",
  "මොකක්ද": "/signs/mokakda.jpg",
  "default": "/signs/default.jpg"
};

const getSignImage = (word) => {
  const cleanWord = word.replace(/[.,!?]/g, '').trim();
  return signLanguageMap[cleanWord] || signLanguageMap.default;
};

const SignResponse = ({ text }) => {
  const words = text.split(/\s+/);
  
  return (
    <div className="sign-response-container">
      {words.map((word, i) => (
        <div key={i} className="sign-word-container">
          <img 
            src={getSignImage(word)} 
            alt={word} 
            className="sign-image"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = signLanguageMap.default;
            }}
          />
          <div className="sign-word-label">{word}</div>
        </div>
      ))}
    </div>
  );
};

const SinhalaVoiceResponseSystem = () => {
  // State for chat messages
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [responseOptions, setResponseOptions] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const messagesEndRef = useRef(null);

  // State for voice input
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);

  // State for response generation
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  // State for voice output
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // State for user memory
  const [userMemory, setUserMemory] = useState(() => {
    const savedMemory = localStorage.getItem('userMemory');
    return savedMemory ? JSON.parse(savedMemory) : {};
  });

  // State for editing
  const [editingResponseIndex, setEditingResponseIndex] = useState(null);
  const [editedResponse, setEditedResponse] = useState('');
  const [editingMemoryIndex, setEditingMemoryIndex] = useState(null);
  const [editedMemoryResponse, setEditedMemoryResponse] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessageText, setEditedMessageText] = useState('');

  // State for sound detection
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [isSoundDetected, setIsSoundDetected] = useState(false);
  const [autoRecordEnabled, setAutoRecordEnabled] = useState(true);
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const soundDetectionInterval = useRef(null);
  const mediaStreamRef = useRef(null);

  // Check if mobile device
  const isMobile = useRef(window.innerWidth <= 768);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      isMobile.current = window.innerWidth <= 768;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize speech synthesis support check and load saved chats
  useEffect(() => {
    setSpeechSupported('speechSynthesis' in window);
    loadChatHistory();

    // Initialize audio context for sound detection
    const initAudioContext = async () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContext();
        setAudioContext(context);
        
        const newAnalyser = context.createAnalyser();
        newAnalyser.fftSize = 256;
        setAnalyser(newAnalyser);
      } catch (err) {
        console.error('Audio Context error:', err);
      }
    };

    initAudioContext();

    return () => {
      stopSoundDetection();
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

  // Start/stop sound detection based on autoRecordEnabled and recording state
  const startSoundDetection = useCallback(async () => {
    try {
      stopSoundDetection();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      soundDetectionInterval.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        if (average > 25 && !isRecording && !isSoundDetected) {
          setIsSoundDetected(true);
          
          setTimeout(() => {
            if (isSoundDetected && !isRecording) {
              startRecording();
            }
          }, 500);
        } else if (average <= 25 && isSoundDetected) {
          setIsSoundDetected(false);
        }
      }, 100);
    } catch (err) {
      console.error('Microphone access error:', err);
      setSpeechError('මයික්‍රොෆෝනයට ප්‍රවේශ වීමට අපොහොසත් විය. කරුණාකර මයික්‍රොෆෝන අවසර පරීක්ෂා කරන්න.');
    }
  }, [analyser, audioContext, isRecording, isSoundDetected]);

  useEffect(() => {
    if (audioContext && analyser && autoRecordEnabled && !isRecording) {
      startSoundDetection();
    } else {
      stopSoundDetection();
    }
  }, [audioContext, analyser, autoRecordEnabled, isRecording, startSoundDetection]);

  // Stop sound detection
  const stopSoundDetection = useCallback(() => {
    if (soundDetectionInterval.current) {
      clearInterval(soundDetectionInterval.current);
      soundDetectionInterval.current = null;
    }
    setIsSoundDetected(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Handle recording status changes
  useEffect(() => {
    if (isRecording) {
      setRecordingStatus('recording');
    } else if (isSoundDetected) {
      setRecordingStatus('detecting');
    } else {
      setRecordingStatus('idle');
    }
  }, [isRecording, isSoundDetected]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, responseOptions]);

  // Save memory to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('userMemory', JSON.stringify(userMemory));
  }, [userMemory]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Load chat history from localStorage
  const loadChatHistory = () => {
    const savedChats = localStorage.getItem('sinhalaChatHistory');
    if (savedChats) {
      setChatHistory(JSON.parse(savedChats));
    }
  };

  // Save current chat to history
  const saveCurrentChat = () => {
    if (messages.length === 0) return;
    
    const chatTitle = messages[0].text.slice(0, 30) + (messages[0].text.length > 30 ? '...' : '');
    const newChat = {
      id: Date.now(),
      title: chatTitle,
      messages: [...messages],
      createdAt: new Date().toLocaleString()
    };

    const updatedHistory = [...chatHistory, newChat];
    setChatHistory(updatedHistory);
    localStorage.setItem('sinhalaChatHistory', JSON.stringify(updatedHistory));
    
    setMessages([]);
    setResponseOptions([]);
  };

  // Load a specific chat from history
  const loadChat = (chatId) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setShowHistory(false);
    }
  };

  // Delete a chat from history
  const deleteChat = (chatId) => {
    const updatedHistory = chatHistory.filter(c => c.id !== chatId);
    setChatHistory(updatedHistory);
    localStorage.setItem('sinhalaChatHistory', JSON.stringify(updatedHistory));
  };

  // Check if a question matches a remembered question
  const isSimilarQuestion = (newQuestion, rememberedQuestion) => {
    const similarityThreshold = 0.7;
    const newWords = newQuestion.toLowerCase().split(/\s+/);
    const rememberedWords = rememberedQuestion.toLowerCase().split(/\s+/);
    
    const commonWords = newWords.filter(word => rememberedWords.includes(word));
    const similarity = commonWords.length / Math.max(newWords.length, rememberedWords.length);
    
    return similarity >= similarityThreshold;
  };

  // Get remembered response for a question if available
  const getRememberedResponse = (question) => {
    for (const rememberedQuestion in userMemory.questions || {}) {
      if (isSimilarQuestion(question, rememberedQuestion)) {
        return userMemory.questions[rememberedQuestion];
      }
    }
    return null;
  };

  // Handle editing a response
  const handleEditResponse = (index, response) => {
    setEditingResponseIndex(index);
    setEditedResponse(response);
  };

  // Save edited response
  const handleSaveEditedResponse = () => {
    if (!editedResponse.trim()) return;
    
    const updatedOptions = [...responseOptions];
    updatedOptions[editingResponseIndex] = editedResponse;
    setResponseOptions(updatedOptions);
    
    setEditingResponseIndex(null);
    setEditedResponse('');
  };

  // Handle editing a memory response
  const handleEditMemoryResponse = (question, response) => {
    setEditingMemoryIndex(question);
    setEditedMemoryResponse(response);
  };

  // Save edited memory response
  const handleSaveEditedMemoryResponse = () => {
    if (!editedMemoryResponse.trim()) return;
    
    setUserMemory(prev => ({
      ...prev,
      questions: {
        ...(prev.questions || {}),
        [editingMemoryIndex]: editedMemoryResponse
      }
    }));
    
    setEditingMemoryIndex(null);
    setEditedMemoryResponse('');
  };

  // Delete a remembered question-response pair
  const handleDeleteMemoryResponse = (question) => {
    if (window.confirm('ඔබට මෙම මතකය මකා දැමීමට අවශ්‍යද?')) {
      const updatedQuestions = { ...userMemory.questions };
      delete updatedQuestions[question];
      
      setUserMemory(prev => ({
        ...prev,
        questions: updatedQuestions
      }));
    }
  };

  // Handle editing a message in chat
  const handleEditMessage = (messageId, text) => {
    setEditingMessageId(messageId);
    setEditedMessageText(text);
  };

  // Save edited message in chat
  const handleSaveEditedMessage = () => {
    if (!editedMessageText.trim()) return;
    
    setMessages(prev => prev.map(msg => 
      msg.id === editingMessageId ? { ...msg, text: editedMessageText } : msg
    ));
    
    const messageToUpdate = messages.find(msg => msg.id === editingMessageId);
    if (messageToUpdate && messageToUpdate.sender === 'ai' && messageToUpdate.isRemembered) {
      const questionIndex = messages.findIndex(msg => msg.id < editingMessageId && msg.sender === 'user');
      if (questionIndex !== -1) {
        const question = messages[questionIndex].text;
        
        setUserMemory(prev => ({
          ...prev,
          questions: {
            ...(prev.questions || {}),
            [question]: editedMessageText
          }
        }));
      }
    }
    
    setEditingMessageId(null);
    setEditedMessageText('');
  };

  // Toggle auto-record feature
  const toggleAutoRecord = () => {
    setAutoRecordEnabled(prev => !prev);
  };

  // Voice Input Functions
  const startRecording = () => {
    setSpeechError(null);
    setInputMessage('');
    
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('ඔබගේ බ්‍රව්සරය හඩ හඳුනාගැනීම සඳහා සහාය නොදක්වයි');
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'si-LK';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setInputMessage(prev => prev + ' ' + transcript);
        setIsSoundDetected(false);
        setIsRecording(false);
        handleSendMessage();
      };

      recognition.onerror = (event) => {
        setSpeechError(`හඩ හඳුනාගැනීමේ දෝෂය: ${event.error}`);
        setIsSoundDetected(false);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setIsSoundDetected(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (err) {
      setSpeechError(err.message);
      setIsSoundDetected(false);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setIsSoundDetected(false);
    }
  };

  // Voice Output Functions
  const speakText = (text) => {
    if (!speechSupported) {
      alert('ඔබගේ බ්‍රව්සරය හඬ පිටකිරීම සඳහා සහාය නොදක්වයි');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'si-LK';

    const voices = window.speechSynthesis.getVoices();
    const sinhalaVoice = voices.find(voice => 
      voice.lang === 'si-LK' || voice.lang.startsWith('si-')
    );

    if (sinhalaVoice) {
      utterance.voice = sinhalaVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      console.error('Speech error:', event);
      setIsSpeaking(false);
      setSpeechError('හඬ පිටකිරීමේ දෝෂයක්: ' + event.error);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Chat Functions
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) {
      setApiError('කරුණාකර පණිවිඩයක් ඇතුළත් කරන්න');
      return;
    }

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setApiError(null);
    setResponseOptions([]);
    stopSpeaking();

    try {
      const rememberedResponse = getRememberedResponse(inputMessage);
      
      if (rememberedResponse) {
        const aiMessage = {
          id: Date.now(),
          text: rememberedResponse,
          sender: 'ai',
          isSignResponse: false,
          isRemembered: true,
          timestamp: new Date().toLocaleTimeString()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        speakText(rememberedResponse);
        return;
      }

      const isPersonalDetailQuestion = inputMessage.includes('නම') || 
                                    inputMessage.includes('ඔයාගේ නම') || 
                                    inputMessage.includes('ඔබගේ නම') ||
                                    inputMessage.includes('කවුද') ||
                                    inputMessage.includes('මොකක්ද ඔබේ නම');

      if (isPersonalDetailQuestion && userMemory.name) {
        const response = `මගේ නම ${userMemory.name}`;
        const aiMessage = {
          id: Date.now(),
          text: response,
          sender: 'ai',
          isSignResponse: false,
          isRemembered: true,
          timestamp: new Date().toLocaleTimeString()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        speakText(response);
        return;
      }

      const prompt = `
        Provide 3 different complete responses in Sinhala (සිංහල) for the following message.
        Each response should be a complete, grammatically correct sentence or paragraph.
        Do not include numbering or labels like "පිළිතුර 1:".
        Make the responses culturally appropriate for Sri Lanka.
        Return only the 3 responses separated by double newlines (\\n\\n).
        
        Message: ${inputMessage}
      `;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }
      );

      const responseText = response.data.candidates[0].content.parts[0].text;
      
      const responses = responseText.split('\n\n')
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .slice(0, 3);

      if (responses.length >= 3) {
        setResponseOptions(responses);
      } else {
        throw new Error('API did not return 3 complete responses');
      }
    } catch (err) {
      console.error('Error generating response:', err);
      setApiError('පිළිතුරු ජනනය කිරීමේදී දෝෂයක් ඇතිවිය. කරුණාකර නැවත උත්සාහ කරන්න.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectResponse = (response) => {
    const aiMessage = {
      id: Date.now(),
      text: response,
      sender: 'ai',
      isSignResponse: true,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [...prev, aiMessage]);
    setResponseOptions([]);
    speakText(response);

    const userMessage = messages[messages.length - 1]?.text;
    
    if (userMessage) {
      const nameMatch = response.match(/මගේ නම (.+?) /) || 
                       response.match(/මම (.+?) /) ||
                       response.match(/මගේ නම (.+?)\./);
      
      if (nameMatch && nameMatch[1]) {
        setUserMemory(prev => ({
          ...prev,
          name: nameMatch[1],
          questions: {
            ...(prev.questions || {}),
            [userMessage]: response
          }
        }));
      } else {
        setUserMemory(prev => ({
          ...prev,
          questions: {
            ...(prev.questions || {}),
            [userMessage]: response
          }
        }));
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearCurrentChat = () => {
    if (window.confirm('ඔබට මෙම සංවාදය මකා දැමීමට අවශ්‍යද?')) {
      setMessages([]);
      setResponseOptions([]);
    }
  };

  const clearMemory = () => {
    if (window.confirm('ඔබට මතකයේ ඇති සියලුම තොරතුරු මකා දැමීමට අවශ්‍යද?')) {
      setUserMemory({});
    }
  };

  return (
    <div className="sinhala-chat-app">
      {/* Sound detection indicator */}
      {recordingStatus === 'detecting' && (
        <div className="sound-detection-indicator">
          <div className="sound-pulse-indicator"></div>
          හඩ හඳුනාගෙන ඇත. පටන් ගනිමින්...
        </div>
      )}

      {/* Chat Header */}
      <div className="chat-header">
        <h1>SIGNIFY</h1>
        <div className="header-controls">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="history-button"
            title="සංවාද ඉතිහාසය"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8V12L15 15M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {!isMobile.current && 'ඉතිහාසය'}
          </button>
          {messages.length > 0 && (
            <>
              <button 
                onClick={saveCurrentChat}
                className="save-chat-button"
                title="සංවාදය සුරකින්න"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 3H16.1716L19 5.82843V19C19 20.1046 18.1046 21 17 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 3V9H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {!isMobile.current && 'සුරකින්න'}
              </button>
              <button 
                onClick={clearCurrentChat}
                className="clear-chat-button"
                title="සංවාදය මකන්න"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {!isMobile.current && 'මකන්න'}
              </button>
            </>
          )}
          <button 
            onClick={() => setShowMemory(!showMemory)}
            className={`memory-button ${showMemory ? 'active' : ''}`}
            title="මතකය පරිපාලනය"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12H15M9 16H15M10 5H14C14.5523 5 15 4.55228 15 4V3.5C15 3.22386 14.7761 3 14.5 3H9.5C9.22386 3 9 3.22386 9 3.5V4C9 4.55228 9.44772 5 10 5ZM7 21H17C18.1046 21 19 20.1046 19 19V9C19 7.89543 18.1046 7 17 7H7C5.89543 7 5 7.89543 5 9V19C5 20.1046 5.89543 21 7 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {!isMobile.current && 'මතකය'}
          </button>
          {/* Auto-record toggle button */}
          <button 
            onClick={toggleAutoRecord}
            className={`auto-record-button ${autoRecordEnabled ? 'active' : ''}`}
            title="ස්වයංක්‍රීය පටිගත කිරීම"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12V15C3 16.6569 4.34315 18 6 18H8L12 22V2L8 6H6C4.34315 6 3 7.34315 3 9V12Z" fill="currentColor"/>
              <path d="M16.5 12C16.5 10.067 15.037 8.5 13 8.5M19 12C19 8.13401 15.866 5 12 5M15.5 12C15.5 13.933 16.963 15.5 19 15.5M21 12C21 15.866 17.866 19 14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {!isMobile.current && 'ස්වයංක්‍රීය'}
          </button>
        </div>
      </div>
      
      {/* Chat History Panel */}
      {showHistory && (
        <div className="history-panel">
          <div className="panel-header">
            <button 
              onClick={() => setShowHistory(false)}
              className="back-button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              ආපසු
            </button>
            <h3>සංවාද ඉතිහාසය</h3>
          </div>
          
          {chatHistory.length === 0 ? (
            <div className="empty-state">
              සුරකින ලද සංවාද නොමැත
            </div>
          ) : (
            <div className="history-list">
              {chatHistory.map((chat) => (
                <div 
                  key={chat.id}
                  className="history-item"
                  onClick={() => loadChat(chat.id)}
                >
                  <div className="history-item-title">
                    {chat.title}
                  </div>
                  <div className="history-item-date">
                    {chat.createdAt}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="delete-history-item"
                    title="මකන්න"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
  
      {/* Memory Panel */}
      {showMemory && (
        <div className="memory-panel">
          <div className="panel-header">
            <button 
              onClick={() => setShowMemory(false)}
              className="back-button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              ආපසු
            </button>
            <h3>මතකය පරිපාලනය</h3>
          </div>
          
          {userMemory.name && (
            <div className="memory-name-section">
              <h4>මගේ නම:</h4>
              <div className="memory-item">
                <span>{userMemory.name}</span>
                <button 
                  onClick={() => {
                    if (window.confirm('ඔබට මෙම නම මකා දැමීමට අවශ්‍යද?')) {
                      setUserMemory(prev => {
                        const newMemory = { ...prev };
                        delete newMemory.name;
                        return newMemory;
                      });
                    }
                  }}
                  className="delete-memory-item"
                  title="මකන්න"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <h4>මතකගත ප්‍රශ්න සහ පිළිතුරු:</h4>
          
          {(!userMemory.questions || Object.keys(userMemory.questions).length === 0) ? (
            <div className="empty-state">
              මතකගත ප්‍රශ්න සහ පිළිතුරු නොමැත
            </div>
          ) : (
            <div className="memory-list">
              {Object.entries(userMemory.questions || {}).map(([question, response]) => (
                <div key={question} className="memory-item-container">
                  {editingMemoryIndex === question ? (
                    <div className="memory-edit-form">
                      <div className="memory-edit-question">ප්‍රශ්නය: {question}</div>
                      <textarea
                        value={editedMemoryResponse}
                        onChange={(e) => setEditedMemoryResponse(e.target.value)}
                        className="memory-edit-textarea"
                      />
                      <div className="memory-edit-buttons">
                        <button
                          onClick={() => {
                            setEditingMemoryIndex(null);
                            setEditedMemoryResponse('');
                          }}
                          className="cancel-edit-button"
                        >
                          අවලංගු
                        </button>
                        <button
                          onClick={handleSaveEditedMemoryResponse}
                          className="save-edit-button"
                        >
                          සුරකින්න
                        </button>
                      </div>
                    </div>
                  ) : (
                    <React.Fragment>
                      <div className="memory-item-question">ප්‍රශ්නය: {question}</div>
                      <div className="memory-item-response">පිළිතුර: {response}</div>
                      <div className="memory-item-actions">
                        <button
                          onClick={() => handleEditMemoryResponse(question, response)}
                          className="edit-memory-button"
                          title="සංස්කරණය"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13M18.4142 3.58579C18.7893 3.21071 19.298 3 19.8284 3C20.3588 3 20.8675 3.21071 21.2426 3.58579C21.6177 3.96086 21.8284 4.46957 21.8284 5C21.8284 5.53043 21.6177 6.03914 21.2426 6.41421L12.7071 14.9497L9 15.8284L9.87868 12.1213L18.4142 3.58579Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteMemoryResponse(question)}
                          className="delete-memory-button"
                          title="මකන්න"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </React.Fragment>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="memory-clear-section">
            <button 
              onClick={clearMemory}
              className="clear-memory-button"
            >
              සියලු මතකය මකන්න
            </button>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="chat-messages-container">
        {messages.length === 0 && !showHistory && !showMemory ? (
          <div className="empty-chat-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 10H8.01M12 10H12.01M16 10H16.01M8 14H8.01M12 14H12.01M16 14H16.01M8 18H8.01M12 18H12.01M16 18H16.01M3 20L4.3 16.7C4.3 16.7 4.3 16.7 4.3 16.7C4.47712 16.2582 4.47712 15.7418 4.3 15.3C4.3 15.3 4.3 15.3 4.3 15.3L7.6 12C7.6 12 7.6 12 7.6 12C8.04177 11.8229 8.55823 11.8229 9 12C9 12 9 12 9 12L12.3 15.3C12.3 15.3 12.3 15.3 12.3 15.3C12.4771 15.7418 12.4771 16.2582 12.3 16.7C12.3 16.7 12.3 16.7 12.3 16.7L13.6 20C13.6 20 13.6 20 13.6 20C13.7771 20.4418 13.7771 20.9582 13.6 21.4C13.6 21.4 13.6 21.4 13.6 21.4L10.3 24.7C10.3 24.7 10.3 24.7 10.3 24.7C9.85823 24.8771 9.34177 24.8771 8.9 24.7C8.9 24.7 8.9 24.7 8.9 24.7L5.6 21.4C5.6 21.4 5.6 21.4 5.6 21.4C5.15823 21.2229 5.15823 20.7065 5.6 20.3C5.6 20.3 5.6 20.3 5.6 20.3L8.9 17C8.9 17 8.9 17 8.9 17C9.34177 16.8229 9.85823 16.8229 10.3 17C10.3 17 10.3 17 10.3 17L13.6 20.3M21 4L19.7 7.3C19.7 7.3 19.7 7.3 19.7 7.3C19.5229 7.74177 19.5229 8.25823 19.7 8.7C19.7 8.7 19.7 8.7 19.7 8.7L16.4 12C16.4 12 16.4 12 16.4 12C15.9582 12.1771 15.4418 12.1771 15 12C15 12 15 12 15 12L11.7 8.7C11.7 8.7 11.7 8.7 11.7 8.7C11.5229 8.25823 11.5229 7.74177 11.7 7.3C11.7 7.3 11.7 7.3 11.7 7.3L10.4 4C10.4 4 10.4 4 10.4 4C10.2229 3.55823 10.2229 3.04177 10.4 2.6C10.4 2.6 10.4 2.6 10.4 2.6L13.7 -0.7C13.7 -0.7 13.7 -0.7 13.7 -0.7C14.1418 -0.877096 14.6582 -0.877096 15.1 -0.7C15.1 -0.7 15.1 -0.7 15.1 -0.7L18.4 2.6C18.4 2.6 18.4 2.6 18.4 2.6C18.8418 2.7771 18.8418 3.29356 18.4 3.7C18.4 3.7 18.4 3.7 18.4 3.7L15.1 7C15.1 7 15.1 7 15.1 7C14.6582 7.1771 14.1418 7.1771 13.7 7C13.7 7 13.7 7 13.7 7L10.4 3.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="empty-chat-title">ඔබගේ සංවාදය ආරම්භ කරන්න</p>
            <p className="empty-chat-subtitle">
              {autoRecordEnabled ? 
                "ස්වයංක්‍රීය පටිගත කිරීම සක්‍රීයයි. කතා කිරීම ආරම්භ කරන්න" : 
                "හඩින් පණිවිඩයක් යැවීමට මයික්‍රොෆෝන බොත්තම ඔබන්න"}
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`message-container ${message.sender}`}
              >
                {editingMessageId === message.id ? (
                  <div className="message-edit-form">
                    <textarea
                      value={editedMessageText}
                      onChange={(e) => setEditedMessageText(e.target.value)}
                      className="message-edit-textarea"
                    />
                    <div className="message-edit-buttons">
                      <button
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditedMessageText('');
                        }}
                        className="cancel-edit-button"
                      >
                        අවලංගු
                      </button>
                      <button
                        onClick={handleSaveEditedMessage}
                        className="save-edit-button"
                      >
                        සුරකින්න
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className={`message-bubble ${message.sender}`}
                  >
                    {message.sender === 'ai' && message.isSignResponse ? (
                      <SignResponse text={message.text} />
                    ) : (
                      message.text
                    )}
                    <div className="message-meta">
                      {message.timestamp}
                      {message.sender === 'ai' && speechSupported && (
                        <button 
                          onClick={() => speakText(message.text)}
                          className="speak-button"
                          title="කියවන්න"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 12V15C3 16.6569 4.34315 18 6 18H8L12 22V2L8 6H6C4.34315 6 3 7.34315 3 9V12Z" fill="#4285F4"/>
                            <path d="M16.5 12C16.5 10.067 15.037 8.5 13 8.5M19 12C19 8.13401 15.866 5 12 5M15.5 12C15.5 13.933 16.963 15.5 19 15.5M21 12C21 15.866 17.866 19 14 19" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      )}
                      {message.sender === 'ai' && message.isRemembered && (
                        <button 
                          onClick={() => handleEditMessage(message.id, message.text)}
                          className="edit-message-button"
                          title="පිළිතුර සංස්කරණය කරන්න"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13M18.4142 3.58579C18.7893 3.21071 19.298 3 19.8284 3C20.3588 3 20.8675 3.21071 21.2426 3.58579C21.6177 3.96086 21.8284 4.46957 21.8284 5C21.8284 5.53043 21.6177 6.03914 21.2426 6.41421L12.7071 14.9497L9 15.8284L9.87868 12.1213L18.4142 3.58579Z" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Response Options with Edit Functionality */}
            {responseOptions.length > 0 && (
              <div className="response-options-container">
                <div className="response-options-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 8V12L15 15M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  ඔබට තෝරාගත හැකි පිළිතුරු:
                </div>
                <div className="response-options-list">
                  {responseOptions.map((option, index) => (
                    <div key={index} className="response-option-container">
                      {editingResponseIndex === index ? (
                        <div className="response-edit-form">
                          <textarea
                            value={editedResponse}
                            onChange={(e) => setEditedResponse(e.target.value)}
                            className="response-edit-textarea"
                          />
                          <div className="response-edit-buttons">
                            <button
                              onClick={() => {
                                setEditingResponseIndex(null);
                                setEditedResponse('');
                              }}
                              className="cancel-edit-button"
                            >
                              අවලංගු
                            </button>
                            <button
                              onClick={handleSaveEditedResponse}
                              className="save-edit-button"
                            >
                              සුරකින්න
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="response-option-content">
                          <button
                            onClick={() => handleSelectResponse(option)}
                            className="response-option-button"
                          >
                            <SignResponse text={option} />
                          </button>
                          <button
                            onClick={() => handleEditResponse(index, option)}
                            className="edit-response-button"
                            title="පිළිතුර සංස්කරණය කරන්න"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13M18.4142 3.58579C18.7893 3.21071 19.298 3 19.8284 3C20.3588 3 20.8675 3.21071 21.2426 3.58579C21.6177 3.96086 21.8284 4.46957 21.8284 5C21.8284 5.53043 21.6177 6.03914 21.2426 6.41421L12.7071 14.9497L9 15.8284L9.87868 12.1213L18.4142 3.58579Z" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {isLoading && (
              <div className="loading-indicator">
                <div className="loading-dots">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input Area */}
      <div className="input-area">
        {apiError && (
          <div className="error-message api-error">
            {apiError}
          </div>
        )}
        
        {speechError && (
          <div className="error-message speech-error">
            {speechError}
          </div>
        )}
        
        <div className="input-container">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="පණිවිඩයක් ඇතුළත් කරන්න..."
            className="message-input"
          />
          
          <div className="input-buttons">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-button ${recordingStatus}`}
              title={recordingStatus === 'recording' ? 'පටිගත කිරීම නවත්තන්න' : 
                     recordingStatus === 'detecting' ? 'හඩ හඳුනාගැනීම...' : 'හඩින් පණිවිඩයක් යවන්න'}
            >
              {recordingStatus === 'recording' && (
                <div className="recording-indicator"></div>
              )}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {recordingStatus === 'recording' ? (
                  <rect x="6" y="5" width="12" height="16" rx="1" fill="currentColor"/>
                ) : (
                  <path d="M3 12V15C3 16.6569 4.34315 18 6 18H8L12 22V2L8 6H6C4.34315 6 3 7.34315 3 9V12Z" fill="currentColor"/>
                )}
                {recordingStatus !== 'recording' && (
                  <path d="M16.5 12C16.5 10.067 15.037 8.5 13 8.5M19 12C19 8.13401 15.866 5 12 5M15.5 12C15.5 13.933 16.963 15.5 19 15.5M21 12C21 15.866 17.866 19 14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                )}
              </svg>
            </button>
            
            <button 
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className={`send-button ${!inputMessage.trim() ? 'disabled' : ''}`}
              title="යවන්න"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Auto-record status indicator */}
        <div className="auto-record-status">
          <div className={`status-indicator ${autoRecordEnabled ? 'on' : 'off'}`}></div>
          <span>
            {autoRecordEnabled ?
              "ස්වයංක්‍රීය පටිගත කිරීම සක්‍රීයයි" :
              "ස්වයංක්‍රීය පටිගත කිරීම අක්‍රීයයි"}
          </span>
        </div>
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        .sinhala-chat-app {
          max-width: 800px;
          height: 100vh;
          margin: 0 auto;
          padding: 10px;
          font-family: 'Iskoola Pota', 'Malithi Web', Arial, sans-serif;
          display: flex;
          flex-direction: column;
          background-color: #f5f5f5;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          position: relative;
          overflow: hidden;
        }
        
        .chat-header {
          display: flex;
          flex-direction: column;
          padding-bottom: 10px;
          border-bottom: 1px solid #e0e0e0;
          margin-bottom: 10px;
        }
        
        .chat-header h1 {
          color: #2c3e50;
          font-size: 20px;
          margin: 0 0 10px 0;
          font-weight: 600;
          text-align: center;
        }
        
        .header-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        
        button {
          transition: all 0.2s ease;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: 'Iskoola Pota', 'Malithi Web', Arial, sans-serif;
          font-size: 13px;
          padding: 6px 10px;
        }
        
        .history-button, .clear-chat-button, .memory-button {
          background-color: #f1f1f1;
          color: #5f6368;
          border: none;
          border-radius: 20px;
        }
        
        .save-chat-button {
          background-color: #4285F4;
          color: white;
          border: none;
          border-radius: 20px;
        }
        
        .memory-button.active {
          background-color: #4285F4;
          color: white;
        }
        
        .auto-record-button {
          background-color: #f1f1f1;
          color: #5f6368;
          border: none;
          border-radius: 20px;
        }
        
        .auto-record-button.active {
          background-color: #4285F4;
          color: white;
        }
        
        /* Sound detection indicator */
        .sound-detection-indicator {
          position: fixed;
          bottom: 80px;
          right: 10px;
          background-color: #4285F4;
          color: white;
          padding: 8px 12px;
          border-radius: 20px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          animation: fadeIn 0.3s ease;
          font-size: 14px;
        }
        
        .sound-pulse-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #34A853;
          animation: pulse 1s infinite;
        }
        
        /* Panel styles */
        .history-panel, .memory-panel {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-height: 100vh;
          background-color: white;
          z-index: 1000;
          padding: 15px;
          overflow-y: auto;
          animation: slideIn 0.3s ease;
        }
        
        @media (min-width: 768px) {
          .history-panel, .memory-panel {
            position: absolute;
            top: 70px;
            left: auto;
            right: 20px;
            width: 350px;
            max-height: 70vh;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          }
          
          .memory-panel {
            width: 400px;
          }
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          position: sticky;
          top: 0;
          background: white;
          padding: 10px 0;
          z-index: 10;
        }
        
        .back-button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #5f6368;
          padding: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .panel-header h3 {
          margin: 0;
          color: #2c3e50;
          font-size: 18px;
          flex: 1;
          text-align: center;
        }
        
        .empty-state {
          padding: 20px;
          text-align: center;
          color: #9e9e9e;
          font-size: 14px;
        }
        
        /* History list styles */
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .history-item {
          padding: 10px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }
        
        .history-item:hover {
          background-color: #f8f9fa;
          border-color: #dadce0;
        }
        
        .history-item-title {
          font-weight: 500;
          margin-bottom: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 14px;
        }
        
        .history-item-date {
          font-size: 11px;
          color: #5f6368;
        }
        
        .delete-history-item {
          position: absolute;
          top: 6px;
          right: 6px;
          background: none;
          border: none;
          cursor: pointer;
          color: #d93025;
          padding: 2px;
        }
        
        /* Memory panel styles */
        .memory-name-section {
          margin-bottom: 15px;
        }
        
        .memory-name-section h4 {
          margin-bottom: 8px;
          color: #5f6368;
          font-size: 14px;
        }
        
        .memory-item {
          padding: 10px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }
        
        .memory-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .memory-item-container {
          position: relative;
        }
        
        .memory-edit-form {
          padding: 10px;
          background-color: #f8f9fa;
          border: 1px solid #dadce0;
          border-radius: 8px;
        }
        
        .memory-edit-question {
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
        }
        
        .memory-edit-textarea, .message-edit-textarea, .response-edit-textarea {
          width: 100%;
          min-height: 80px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          font-family: 'Iskoola Pota', 'Malithi Web', Arial, sans-serif;
          margin-bottom: 8px;
          resize: vertical;
        }
        
        .memory-edit-buttons, .message-edit-buttons, .response-edit-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }
        
        .cancel-edit-button {
          padding: 6px 10px;
          background-color: #f1f1f1;
          color: #5f6368;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }
        
        .save-edit-button {
          padding: 6px 10px;
          background-color: #4285F4;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }
        
        .memory-item-question {
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
        }
        
        .memory-item-response {
          margin-bottom: 6px;
          font-size: 14px;
        }
        
        .memory-item-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }
        
        .edit-memory-button, .edit-message-button {
          padding: 5px 10px;
          background-color: #f1f1f1;
          color: #5f6368;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }
        
        .delete-memory-button {
          padding: 5px 10px;
          background-color: #fce8e6;
          color: #d93025;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }
        
        .memory-clear-section {
          margin-top: 15px;
          display: flex;
          justify-content: flex-end;
        }
        
        .clear-memory-button {
          padding: 6px 10px;
          background-color: #fce8e6;
          color: #d93025;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }
        
        /* Chat messages container */
        .chat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          background-color: white;
          border-radius: 8px;
          margin-bottom: 10px;
          scroll-behavior: smooth;
        }
        
        /* Empty chat state */
        .empty-chat-state {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: #9e9e9e;
          text-align: center;
          padding: 20px;
        }
        
        .empty-chat-title {
          margin-top: 10px;
          font-size: 16px;
          color: #5f6368;
        }
        
        .empty-chat-subtitle {
          margin-top: 5px;
          font-size: 14px;
          color: #9e9e9e;
          max-width: 80%;
          margin-left: auto;
          margin-right: auto;
        }
        
        /* Message styles */
        .message-container {
          display: flex;
          flex-direction: column;
          margin-bottom: 12px;
        }
        
        .message-container.user {
          align-items: flex-end;
        }
        
        .message-container.ai {
          align-items: flex-start;
        }
        
        .message-bubble {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.4;
          position: relative;
          word-break: break-word;
        }
        
        .message-bubble.user {
          background-color: #dcf8c6;
          border-radius: 16px 16px 0 16px;
          color: #000;
        }
        
        .message-bubble.ai {
          background-color: #f1f1f1;
          border-radius: 16px 16px 16px 0;
          color: #000;
        }
        
        .message-meta {
          position: absolute;
          bottom: -16px;
          font-size: 10px;
          color: #999;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .message-container.user .message-meta {
          right: 5px;
        }
        
        .message-container.ai .message-meta {
          left: 5px;
        }
        
        .speak-button, .edit-message-button {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        
        /* Sign response styles */
        .sign-response-container {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
          padding: 6px;
        }
        
        .sign-word-container {
          text-align: center;
        }
        
        .sign-image {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
          transition: transform 0.2s ease;
        }
        
        @media (min-width: 480px) {
          .sign-image {
            width: 80px;
            height: 80px;
          }
        }
        
        .sign-image:hover {
          transform: scale(1.05);
        }
        
        .sign-word-label {
          font-size: 11px;
          margin-top: 4px;
        }
        
        /* Response options */
        .response-options-container {
          margin-bottom: 12px;
          padding: 10px;
          background-color: #f8f9fa;
          border-radius: 10px;
          border: 1px solid #e0e0e0;
        }
        
        .response-options-header {
          font-size: 12px;
          color: #5f6368;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .response-options-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .response-option-container {
          position: relative;
        }
        
        .response-option-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .response-option-button {
          width: 100%;
          padding: 10px;
          text-align: left;
          background-color: white;
          border: 1px solid #dadce0;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          line-height: 1.4;
          transition: all 0.2s;
        }
        
        .response-option-button:hover {
          background-color: #f5f5f5;
          border-color: #c9c9c9;
        }
        
        .edit-response-button {
          position: absolute;
          top: 6px;
          right: 6px;
          padding: 3px;
          background-color: rgba(255,255,255,0.8);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .response-option-container:hover .edit-response-button {
          opacity: 1;
        }
        
        /* Loading indicator */
        .loading-indicator {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 12px;
        }
        
        .loading-dots {
          padding: 8px 12px;
          border-radius: 16px 16px 16px 0;
          background-color: #f1f1f1;
          color: #000;
          font-size: 14px;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .loading-dot {
          width: 10px;
          height: 10px;
          background-color: #ccc;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        
        .loading-dot:nth-child(2) {
          animation-delay: 0.3s;
        }
        
        .loading-dot:nth-child(3) {
          animation-delay: 0.6s;
        }
        
        /* Input area */
        .input-area {
          padding: 10px;
          background-color: white;
          border-radius: 10px;
          box-shadow: 0 -2px 5px rgba(0,0,0,0.05);
        }
        
        .error-message {
          padding: 8px;
          border-radius: 6px;
          margin-bottom: 10px;
          font-size: 13px;
        }
        
        .api-error {
          background-color: #fadbd8;
          color: #c0392b;
        }
        
        .speech-error {
          background-color: #fce8e6;
          color: #d93025;
        }
        
        .input-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .message-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #ddd;
          border-radius: 20px;
          font-size: 14px;
          min-height: 40px;
          max-height: 100px;
          resize: none;
          outline: none;
          font-family: 'Iskoola Pota', 'Malithi Web', Arial, sans-serif;
          transition: border 0.2s;
        }
        
        .message-input:focus {
          border-color: #4285F4;
        }
        
        .input-buttons {
          display: flex;
          gap: 6px;
        }
        
        .record-button {
          padding: 10px;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: all 0.2s;
          width: 44px;
          height: 44px;
        }
        
        .record-button.idle {
          background-color: #f1f1f1;
          color: #5f6368;
        }
        
        .record-button.detecting {
          background-color: #FBBC05;
          color: white;
        }
        
        .record-button.recording {
          background-color: #DB4437;
          color: white;
        }
        
        .recording-indicator {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 10px;
          height: 10px;
          background-color: #DB4437;
          border-radius: 50%;
          border: 2px solid white;
          animation: pulse 1.5s infinite;
        }
        
        .send-button {
          padding: 10px;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
        }
        
        .send-button:not(.disabled) {
          background-color: #128C7E;
          color: white;
        }
        
        .send-button.disabled {
          background-color: #cccccc;
          color: white;
          cursor: not-allowed;
        }
        
        /* Auto-record status indicator */
        .auto-record-status {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          font-size: 11px;
          color: #5f6368;
        }
        
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        
        .status-indicator.on {
          background-color: #34A853;
        }
        
        .status-indicator.off {
          background-color: #EA4335;
        }
        
        /* Animations */
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @media (min-width: 768px) {
          .sinhala-chat-app {
            height: 90vh;
            padding: 20px;
            border-radius: 16px;
          }
          
          .chat-header {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 15px;
            margin-bottom: 15px;
          }
          
          .chat-header h1 {
            margin: 0;
            text-align: left;
            font-size: 22px;
          }
          
          .header-controls {
            justify-content: flex-end;
          }
          
          button {
            font-size: 14px;
            padding: 8px 12px;
            gap: 6px;
          }
          
          .chat-messages-container {
            padding: 10px;
            border-radius: 12px;
            margin-bottom: 15px;
          }
          
          .message-bubble {
            max-width: 80%;
            padding: 12px 16px;
            font-size: 15px;
          }
          
          .input-area {
            padding: 12px;
            border-radius: 12px;
          }
          
          .message-input {
            padding: 12px 16px;
            font-size: 15px;
          }
          
          .input-buttons {
            gap: 8px;
          }
          
          .record-button, .send-button {
            width: 48px;
            height: 48px;
          }
          
          .auto-record-status {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default SinhalaVoiceResponseSystem;