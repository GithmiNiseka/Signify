// More comprehensive mapping with unique images
const signLanguageMap = {
  // Greetings
  "ආයුබෝවන්": "/signs/greetings/ayubowan.jpg",
  "ස්තූතියි": "/signs/greetings/sthuthiyi.jpg",
  "කොහොමද": "/signs/greetings/kohomada.jpg",
  
  // Questions
  "මොකක්ද": "/signs/questions/mokakda.jpg",
  "කොහෙද": "/signs/questions/koheda.jpg",
  "කවුද": "/signs/questions/kawada.jpg",
  "කොහොමද": "/signs/questions/kohomada.jpg",
  
  // Responses
  "හොඳින්": "/signs/responses/hodin.jpg",
  "ඔයාගේ": "/signs/pronouns/oyage.jpg",
  "නම": "/signs/common/nam.jpg",
  
  // Default fallback
  "default": "/signs/default.jpg"
};

// Dynamic image selection based on context
export const getSignImage = (word, context = '') => {
  const cleanWord = word.replace(/[.,!?]/g, '').trim();
  
  // Try exact match first
  if (signLanguageMap[cleanWord]) {
    return signLanguageMap[cleanWord];
  }
  
  // Try contextual matches (folder structure based)
  const contextualPath = `/signs/${context}/${cleanWord}.jpg`;
  if (context && !contextualPath.includes('undefined')) {
    return contextualPath;
  }
  
  return signLanguageMap.default;
};

export const getContextualSigns = (sentence) => {
  if (sentence.includes('?')) return 'questions';
  if (sentence.includes('ස්තූතියි')) return 'greetings';
  if (sentence.includes('මම') || sentence.includes('ඔයා')) return 'pronouns';
  return '';
};