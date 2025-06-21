import cold from './assets/ssl/Cold.jpeg';
import wound from './assets/ssl/Wound.jpeg';
import headache from './assets/ssl/Headache.jpeg';
import fever from './assets/ssl/Fever.jpeg';
import future from './assets/ssl/Future.jpeg';
import knee from './assets/ssl/Knee.jpeg';
import always from './assets/ssl/Always.jpeg';
import chestPain from './assets/ssl/chest pain .jpeg';
import chickenpox from './assets/ssl/ChickenPox.jpeg';
import cough from './assets/ssl/Cough.jpeg';
import december from './assets/ssl/December.jpeg';
import everyday from './assets/ssl/Everyday.jpeg';
import faint from './assets/ssl/Faint.jpeg';
import legs from './assets/ssl/legs.jpeg';
import mumps from './assets/ssl/Mumps.jpeg';
import november from './assets/ssl/November.jpeg';
import october from './assets/ssl/October.jpeg';
import september from './assets/ssl/September.jpeg';
import term from './assets/ssl/Term.jpeg';
import virus from './assets/ssl/Virus.jpeg';

import defaultImage from './assets/ssl/Aids.jpeg';

const signDatabase = {
  "cold": {
    sinhala: "සෙම්ප්‍රතික්ශාව",
    image: cold
  },
  "wound": {
    sinhala: "තුවාල",
    image: wound
  },
  "headache": {
    sinhala: "හිසරදයක්",
    image: headache
  },
  "fever": {
    sinhala: "උණ",
    image: fever
  },
    "future": {
    sinhala: "අනාගතය",
    image: future
  },
   "knee": {
    sinhala: "දණහිස",
    image: knee
  },
   "always": {
    sinhala: "සැමවිටම",
    image: always
  },
   "chestPain": {
    sinhala: "පපුවේ වේදනාව",
    image: chestPain
  },
  
   "chickenpox": {
    sinhala: "පපුවේ පැපොල",
    image: chickenpox
  },
  
   "cough": {
    sinhala: "කැස්ස",
    image: cough
  },
  visualViewport,
   "december": {
    sinhala: "දෙසැම්බර්",
    image: december
  },
  
   "everyday": {
    sinhala: "සෑම දිනම",
    image: everyday
  },
   "faint": {
    sinhala: "ක්ලාන්ත",
    image: faint
  },
   "legs": {
    sinhala: "කකුල්",
    image: legs
  },
   "mumps": {
    sinhala: "කම්මුල්ගාය",
    image: mumps
  },
   "november": {
    sinhala: "නොවැම්බර්",
    image: november
  },
   "october": {
    sinhala: "ඔක්තෝබර්",
    image: october
  },
   "september": {
    sinhala: "සැප්තැම්බර්",
    image: september
  },
   "term": {
    sinhala: "වාරය ",
    image: term
  },
   "virus": {
    sinhala: "වයිරසය",
    image: virus
  },
};

const sinhalaSignMap = {};
Object.values(signDatabase).forEach(item => {
  sinhalaSignMap[item.sinhala] = item.image;
});

export { signDatabase, sinhalaSignMap, defaultImage };