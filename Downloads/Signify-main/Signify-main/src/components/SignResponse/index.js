import React from 'react';
import { getSignImage } from '../../utils/signLanguageMap';
import styles from './styles.module.css';

const SignImage = ({ word }) => {
  return (
    <div className={styles.signContainer}>
      <img
        src={getSignImage(word)}
        alt={word}
        className={styles.signImage}
        loading="lazy"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/signs/default.jpg";
        }}
      />
      <span className={styles.signLabel}>{word}</span>
    </div>
  );
};

const SignResponse = ({ text }) => {
  // Split text into words and filter out empty strings
  const words = text.split(/\s+/).filter(word => word.length > 0);
  
  return (
    <div className={styles.signResponseContainer}>
      {words.map((word, index) => (
        <SignImage key={`${word}-${index}`} word={word} />
      ))}
    </div>
  );
};

export default SignResponse;