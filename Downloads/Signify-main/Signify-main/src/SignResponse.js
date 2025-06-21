import React from 'react';
import { sinhalaSignMap, defaultImage } from './signConfig';

const findSignForWord = (word) => {
  // Try exact match first
  if (sinhalaSignMap[word]) {
    return { word, image: sinhalaSignMap[word] };
  }

  // Try partial matches (for word variations)
  const matchingKey = Object.keys(sinhalaSignMap).find(key => 
    word.includes(key) || key.includes(word)
  );

  return matchingKey ? { word: matchingKey, image: sinhalaSignMap[matchingKey] } : null;
};

const SignResponse = ({ text }) => {
  const tokens = text.split(/([\s.,!?]+)/).filter(token => token);

  return (
    <div className="sign-response-container">
      {tokens.map((token, index) => {
        if (!token.trim()) return <span key={index} className="whitespace">{token}</span>;
        if (/^[.,!?]+$/.test(token)) return <span key={index} className="punctuation">{token}</span>;

        const sign = findSignForWord(token);
        
        return sign ? (
          <div key={index} className="sign-token-container">
            <div className="sign-image-container">
              <img
                src={sign.image}
                alt={sign.word}
                className="sign-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = defaultImage;
                }}
              />
              <div className="sign-word-label">
                <span className="sinhala-word">{sign.word}</span>
              </div>
            </div>
          </div>
        ) : (
          <span key={index} className="text-token">{token}</span>
        );
      })}
    </div>
  );
};

export default SignResponse;