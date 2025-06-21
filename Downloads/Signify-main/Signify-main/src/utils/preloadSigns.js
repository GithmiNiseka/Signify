import { signLanguageWords } from './signLanguageMap';

export const preloadSigns = () => {
  const signsToPreload = [
    "/signs/common/ayubowan.jpg",
    "/signs/common/sthuthiyi.jpg",
    "/signs/common/kohomada.jpg",
    "/signs/default.jpg"
  ];
  
  signsToPreload.forEach(src => {
    const img = new Image();
    img.src = src;
  });
};