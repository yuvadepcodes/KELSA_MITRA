import { SupportedLang } from '../services/voiceService';

export interface BrandParts {
  prefix: string;
  suffix: string;
  full: string;
  suffixFontClass: string;
}

export function getBrandParts(lang: SupportedLang): BrandParts {
  if (lang === 'kn') {
    return {
      prefix: 'KELSA',
      suffix: 'ಮಿತ್ರ',
      full: 'KELSAಮಿತ್ರ',
      suffixFontClass: "font-['Noto_Sans_Kannada',sans-serif]",
    };
  }
  if (lang === 'hi') {
    return {
      prefix: 'KELSA',
      suffix: 'मित्र',
      full: 'KELSAमित्र',
      suffixFontClass: "font-['Noto_Sans_Devanagari',sans-serif]",
    };
  }
  return {
    prefix: 'KELSA',
    suffix: 'Mitra',
    full: 'KELSAMitra',
    suffixFontClass: '',
  };
}

export function localizeRoleLabel(role: 'worker' | 'employer', lang: SupportedLang): string {
  if (lang === 'kn') return role === 'employer' ? 'ಉದ್ಯೋಗದಾತ' : 'ಕೆಲಸಗಾರ';
  if (lang === 'hi') return role === 'employer' ? 'नियोक्ता' : 'कामगार';
  return role === 'employer' ? 'Employer' : 'Worker';
}

const KNOWN_TERMS: Array<{ en: string; kn: string; hi: string }> = [
  { en: 'Electrician', kn: 'ಎಲೆಕ್ಟ್ರಿಷಿಯನ್', hi: 'इलेक्ट्रीशियन' },
  { en: 'Mason', kn: 'ಗೌಂಡಿ', hi: 'राजमिस्त्री' },
  { en: 'Helper', kn: 'ಸಹಾಯಕ', hi: 'सहायक' },
  { en: 'Plumber', kn: 'ಪ್ಲಂಬರ್', hi: 'प्लंबर' },
  { en: 'Carpenter', kn: 'ಬಡಗಿ', hi: 'बढ़ई' },
  { en: 'Welder', kn: 'ವೆಲ್ಡರ್', hi: 'वेल्डर' },
  { en: 'Painter', kn: 'ಪೇಂಟರ್', hi: 'पेंटर' },
  { en: 'Mechanic', kn: 'ಮೆಕ್ಯಾನಿಕ್', hi: 'मैकेनिक' },
  { en: 'Driver', kn: 'ಡ್ರೈವರ್', hi: 'ड्राइवर' },
  { en: 'Loader', kn: 'ಲೋಡರ್', hi: 'लोडर' },
  { en: 'Cook', kn: 'ಅಡುಗೆಯವರು', hi: 'रसोइया' },
  { en: 'Worker', kn: 'ಕೆಲಸಗಾರ', hi: 'कामगार' },
  { en: 'Daily Shift Worker', kn: 'ದೈನಂದಿನ ಕೆಲಸಗಾರ', hi: 'दैनिक कामगार' },
  { en: 'Local Business', kn: 'ಸ್ಥಳೀಯ ವ್ಯಾಪಾರ', hi: 'स्थानीय व्यवसाय' },
  { en: 'Hardware Shop', kn: 'ಹಾರ್ಡ್‌ವೇರ್ ಅಂಗಡಿ', hi: 'हार्डवेयर दुकान' },
  { en: 'Chickpet', kn: 'ಚಿಕ್ಕಪೇಟೆ', hi: 'चिकपेट' },
  { en: 'Chickpet', kn: 'ಚಿಕ್‌ಪೇಟೆ', hi: 'चिकपेट' },
  { en: 'Kyathsandra', kn: 'ಕ್ಯಾತ್ಸಂದ್ರ', hi: 'क्याथसंद्रा' },
  { en: 'APMC Yard', kn: 'ಎಪಿಎಂಸಿ ಯಾರ್ಡ್', hi: 'एपीएमसी यार्ड' },
  { en: 'B.H. Road', kn: 'ಬಿ.ಹೆಚ್. ರೋಡ್', hi: 'बी.एच. रोड' },
  { en: 'B.H. Road', kn: 'ಬಿ.ಹೆಚ್. ರಸ್ತೆ', hi: 'बी.एच. रोड' },
  { en: 'Industrial Area', kn: 'ಕೈಗಾರಿಕಾ ಪ್ರದೇಶ', hi: 'औद्योगिक क्षेत्र' },
  { en: 'Main Market', kn: 'ಮುಖ್ಯ ಮಾರುಕಟ್ಟೆ', hi: 'मुख्य बाज़ार' },
];

const KANNADA_REGEX = /[\u0C80-\u0CFF]/;
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

// Kannada -> Devanagari character table
const KN_TO_DEVA: Record<string, string> = {
  // Independent vowels
  'ಅ': 'अ', 'ಆ': 'आ', 'ಇ': 'इ', 'ಈ': 'ई', 'ಉ': 'उ', 'ಊ': 'ऊ',
  'ಋ': 'ऋ', 'ೠ': 'ऋ', 'ಎ': 'ए', 'ಏ': 'ए', 'ಐ': 'ऐ', 'ಒ': 'ओ', 'ಓ': 'ओ', 'ಔ': 'औ',
  // Signs
  'ಂ': 'ं', 'ಃ': 'ः',
  // Consonants
  'ಕ': 'क', 'ಖ': 'ख', 'ಗ': 'ग', 'ಘ': 'घ', 'ಙ': 'ङ',
  'ಚ': 'च', 'ಛ': 'छ', 'ಜ': 'ज', 'ಝ': 'झ', 'ಞ': 'ञ',
  'ಟ': 'ट', 'ಠ': 'ठ', 'ಡ': 'ड', 'ಢ': 'ढ', 'ಣ': 'ण',
  'ತ': 'त', 'ಥ': 'थ', 'ದ': 'द', 'ಧ': 'ध', 'ನ': 'न',
  'ಪ': 'प', 'ಫ': 'फ', 'ಬ': 'ब', 'ಭ': 'भ', 'ಮ': 'म',
  'ಯ': 'य', 'ರ': 'र', 'ಱ': 'र', 'ಲ': 'ल', 'ಳ': 'ल', 'ೞ': 'ल',
  'ವ': 'व', 'ಶ': 'श', 'ಷ': 'ष', 'ಸ': 'स', 'ಹ': 'ह',
  // Matras
  'ಾ': 'ा', 'ಿ': 'ि', 'ೀ': 'ी', 'ು': 'ु', 'ೂ': 'ू', 'ೃ': 'ृ', 'ೄ': 'ृ',
  'ೆ': 'े', 'ೇ': 'े', 'ೈ': 'ै', 'ೊ': 'ो', 'ೋ': 'ो', 'ೌ': 'ौ',
  '್': '्',
  // Numerals
  '೦': '0', '೧': '1', '೨': '2', '೩': '3', '೪': '4',
  '೫': '5', '೬': '6', '೭': '7', '೮': '8', '೯': '9',
};

// Devanagari -> Kannada character table
const DEVA_TO_KN: Record<string, string> = {
  'अ': 'ಅ', 'आ': 'ಆ', 'इ': 'ಇ', 'ई': 'ಈ', 'उ': 'ಉ', 'ऊ': 'ಊ',
  'ऋ': 'ಋ', 'ऎ': 'ಎ', 'ए': 'ಏ', 'ऐ': 'ಐ', 'ऑ': 'ಒ', 'ऒ': 'ಒ', 'ओ': 'ಓ', 'औ': 'ಔ',
  'ं': 'ಂ', 'ँ': 'ಂ', 'ः': 'ಃ',
  'क': 'ಕ', 'ख': 'ಖ', 'ग': 'ಗ', 'घ': 'ಘ', 'ङ': 'ಙ',
  'च': 'ಚ', 'छ': 'ಛ', 'ज': 'ಜ', 'झ': 'ಝ', 'ञ': 'ಞ',
  'ट': 'ಟ', 'ठ': 'ಠ', 'ड': 'ಡ', 'ढ': 'ಢ', 'ण': 'ಣ',
  'त': 'ತ', 'थ': 'ಥ', 'द': 'ದ', 'ध': 'ಧ', 'न': 'ನ',
  'प': 'ಪ', 'फ': 'ಫ', 'ब': 'ಬ', 'भ': 'ಭ', 'म': 'ಮ',
  'य': 'ಯ', 'र': 'ರ', 'ल': 'ಲ', 'ळ': 'ಳ', 'व': 'ವ',
  'श': 'ಶ', 'ष': 'ಷ', 'स': 'ಸ', 'ह': 'ಹ',
  'क़': 'ಕ', 'ख़': 'ಖ', 'ग़': 'ಗ', 'ज़': 'ಜ', 'फ़': 'ಫ', 'ड़': 'ಡ', 'ढ़': 'ಢ',
  'ा': 'ಾ', 'ि': 'ಿ', 'ी': 'ೀ', 'ु': 'ು', 'ू': 'ೂ', 'ृ': 'ೃ',
  'ॆ': 'ೆ', 'े': 'ೇ', 'ै': 'ೈ', 'ॉ': 'ೊ', 'ॊ': 'ೊ', 'ो': 'ೋ', 'ौ': 'ೌ',
  '्': '್',
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

const INDIC_VOWELS_LATIN: Record<string, string> = {
  'ಅ': 'a', 'ಆ': 'aa', 'ಇ': 'i', 'ಈ': 'ee', 'ಉ': 'u', 'ಊ': 'oo',
  'ಋ': 'ri', 'ಎ': 'e', 'ಏ': 'e', 'ಐ': 'ai', 'ಒ': 'o', 'ಓ': 'o', 'ಔ': 'au',
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ऎ': 'e', 'ए': 'e', 'ऐ': 'ai', 'ऑ': 'o', 'ऒ': 'o', 'ओ': 'o', 'औ': 'au',
};

const INDIC_CONSONANTS_LATIN: Record<string, string> = {
  // Kannada
  'ಕ': 'k', 'ಖ': 'kh', 'ಗ': 'g', 'ಘ': 'gh', 'ಙ': 'ng',
  'ಚ': 'ch', 'ಛ': 'chh', 'ಜ': 'j', 'ಝ': 'jh', 'ಞ': 'ny',
  'ಟ': 't', 'ಠ': 'th', 'ಡ': 'd', 'ಢ': 'dh', 'ಣ': 'n',
  'ತ': 't', 'ಥ': 'th', 'ದ': 'd', 'ಧ': 'dh', 'ನ': 'n',
  'ಪ': 'p', 'ಫ': 'ph', 'ಬ': 'b', 'ಭ': 'bh', 'ಮ': 'm',
  'ಯ': 'y', 'ರ': 'r', 'ಱ': 'r', 'ಲ': 'l', 'ಳ': 'l', 'ೞ': 'l',
  'ವ': 'v', 'ಶ': 'sh', 'ಷ': 'sh', 'ಸ': 's', 'ಹ': 'h',
  // Devanagari
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
};

const INDIC_MATRAS_LATIN: Record<string, string> = {
  'ಾ': 'a', 'ಿ': 'i', 'ೀ': 'ee', 'ು': 'u', 'ೂ': 'oo', 'ೃ': 'ri',
  'ೆ': 'e', 'ೇ': 'e', 'ೈ': 'ai', 'ೊ': 'o', 'ೋ': 'o', 'ೌ': 'au',
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
  'ॆ': 'e', 'े': 'e', 'ै': 'ai', 'ॉ': 'o', 'ॊ': 'o', 'ो': 'o', 'ौ': 'au',
};

const LABIAL_FOLLOWERS = new Set(['ಪ', 'ಫ', 'ಬ', 'ಭ', 'ಮ', 'ವ', 'प', 'फ', 'ब', 'भ', 'म', 'व']);

function isVirama(ch: string | undefined): boolean {
  return ch === '್' || ch === '्';
}

function isAnusvara(ch: string | undefined): boolean {
  return ch === 'ಂ' || ch === 'ं' || ch === 'ँ';
}

function isVisarga(ch: string | undefined): boolean {
  return ch === 'ಃ' || ch === 'ः';
}

function kannadaWordToDevanagari(word: string): string {
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (ch === '\u200C' || ch === '\u200D') continue;
    out += KN_TO_DEVA[ch] ?? ch;
  }
  // Natural Hindi schwa deletion: drop trailing virama at end of word (e.g., ಶೇಖರ್ -> शेखर)
  if (out.length > 2 && out.endsWith('्')) {
    out = out.slice(0, -1);
  }
  return out;
}

function devanagariWordToKannada(word: string): string {
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (ch === '\u200C' || ch === '\u200D' || ch === '़') continue;
    const two = word.slice(i, i + 2);
    if (DEVA_TO_KN[two]) {
      out += DEVA_TO_KN[two];
      i++;
      continue;
    }
    out += DEVA_TO_KN[ch] ?? ch;
  }
  return out;
}

function indicWordToLatin(word: string): string {
  const isDeva = DEVANAGARI_REGEX.test(word);
  const chars = Array.from(word).filter((c) => c !== '\u200C' && c !== '\u200D' && c !== '़');
  let out = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (INDIC_VOWELS_LATIN[ch]) {
      // Word-initial 'ಆ'/'आ' -> 'A', 'ಈ'/'ई' -> 'I' or 'Ee'
      out += INDIC_VOWELS_LATIN[ch];
      continue;
    }

    if (INDIC_CONSONANTS_LATIN[ch]) {
      const base = INDIC_CONSONANTS_LATIN[ch];
      if (isVirama(next)) {
        out += base;
        i++; // skip virama
        continue;
      }
      if (next && INDIC_MATRAS_LATIN[next]) {
        let vowel = INDIC_MATRAS_LATIN[next];
        const afterMatra = chars[i + 2];
        // Word-final long 'ee' in names sounds more natural as 'i' (e.g., Lakshmi, Devi)
        if (vowel === 'ee' && !afterMatra) {
          vowel = 'i';
        }
        out += base + vowel;
        i++; // skip matra
        continue;
      }
      // Bare consonant (inherent 'a'):
      // In Devanagari, drop final schwa if at end of word and not preceded by virama
      const prev = chars[i - 1];
      const isWordFinal = i === chars.length - 1;
      if (isDeva && isWordFinal && !isVirama(prev) && out.length > 0) {
        out += base;
      } else {
        out += base + 'a';
      }
      continue;
    }

    if (isAnusvara(ch)) {
      const nextChar = chars[i + 1];
      if (!nextChar || LABIAL_FOLLOWERS.has(nextChar)) {
        out += 'm';
      } else {
        out += 'n';
      }
      continue;
    }

    if (isVisarga(ch)) {
      out += 'h';
      continue;
    }

    if (KN_TO_DEVA[ch] && !isNaN(Number(KN_TO_DEVA[ch]))) {
      out += KN_TO_DEVA[ch];
      continue;
    }

    out += ch;
  }

  if (!out) return word;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// Phonetic Latin -> Kannada / Devanagari for English-entered names when user switches to kn / hi
const LATIN_CONSONANTS: Array<[string, { kn: string; hi: string }]> = [
  ['shh', { kn: 'ಷ', hi: 'ष' }],
  ['chh', { kn: 'ಛ', hi: 'छ' }],
  ['ksh', { kn: 'ಕ್ಷ', hi: 'क्ष' }],
  ['sh', { kn: 'ಶ', hi: 'श' }],
  ['ch', { kn: 'ಚ', hi: 'च' }],
  ['kh', { kn: 'ಖ', hi: 'ख' }],
  ['gh', { kn: 'ಘ', hi: 'घ' }],
  ['jh', { kn: 'ಝ', hi: 'झ' }],
  ['th', { kn: 'ಥ', hi: 'थ' }],
  ['dh', { kn: 'ಧ', hi: 'ध' }],
  ['ph', { kn: 'ಫ', hi: 'फ' }],
  ['bh', { kn: 'ಭ', hi: 'भ' }],
  ['ng', { kn: 'ಂಗ', hi: 'ंग' }],
  ['k', { kn: 'ಕ', hi: 'क' }],
  ['c', { kn: 'ಕ', hi: 'क' }],
  ['g', { kn: 'ಗ', hi: 'ग' }],
  ['j', { kn: 'ಜ', hi: 'ज' }],
  ['t', { kn: 'ತ', hi: 'त' }],
  ['d', { kn: 'ದ', hi: 'द' }],
  ['n', { kn: 'ನ', hi: 'न' }],
  ['p', { kn: 'ಪ', hi: 'प' }],
  ['f', { kn: 'ಫ', hi: 'फ' }],
  ['b', { kn: 'ಬ', hi: 'ब' }],
  ['m', { kn: 'ಮ', hi: 'म' }],
  ['y', { kn: 'ಯ', hi: 'य' }],
  ['r', { kn: 'ರ', hi: 'र' }],
  ['l', { kn: 'ಲ', hi: 'ल' }],
  ['v', { kn: 'ವ', hi: 'व' }],
  ['w', { kn: 'ವ', hi: 'व' }],
  ['s', { kn: 'ಸ', hi: 'स' }],
  ['h', { kn: 'ಹ', hi: 'ह' }],
  ['z', { kn: 'ಜ', hi: 'ज़' }],
];

const LATIN_VOWELS: Array<[string, { knInd: string; knMatra: string; hiInd: string; hiMatra: string }]> = [
  ['aa', { knInd: 'ಆ', knMatra: 'ಾ', hiInd: 'आ', hiMatra: 'ा' }],
  ['ee', { knInd: 'ಈ', knMatra: 'ೀ', hiInd: 'ई', hiMatra: 'ी' }],
  ['oo', { knInd: 'ಊ', knMatra: 'ೂ', hiInd: 'ऊ', hiMatra: 'ू' }],
  ['ai', { knInd: 'ಐ', knMatra: 'ೈ', hiInd: 'ऐ', hiMatra: 'ै' }],
  ['au', { knInd: 'ಔ', knMatra: 'ೌ', hiInd: 'औ', hiMatra: 'ौ' }],
  ['ou', { knInd: 'ಔ', knMatra: 'ೌ', hiInd: 'औ', hiMatra: 'ौ' }],
  ['a', { knInd: 'ಅ', knMatra: '', hiInd: 'अ', hiMatra: '' }],
  ['i', { knInd: 'ಇ', knMatra: 'ಿ', hiInd: 'इ', hiMatra: 'ि' }],
  ['u', { knInd: 'ಉ', knMatra: 'ು', hiInd: 'उ', hiMatra: 'ु' }],
  ['e', { knInd: 'ಏ', knMatra: 'ೇ', hiInd: 'ए', hiMatra: 'े' }],
  ['o', { knInd: 'ಓ', knMatra: 'ೋ', hiInd: 'ओ', hiMatra: 'ो' }],
];

function latinWordToIndic(word: string, target: 'kn' | 'hi'): string {
  if (!/^[a-zA-Z]+$/.test(word)) return word;
  const lower = word.toLowerCase();
  let i = 0;
  let out = '';

  while (i < lower.length) {
    const rest = lower.slice(i);
    const matchedConsonant = LATIN_CONSONANTS.find(([pat]) => rest.startsWith(pat));

    if (matchedConsonant) {
      const [cPat, cMap] = matchedConsonant;
      const consChar = target === 'kn' ? cMap.kn : cMap.hi;
      i += cPat.length;

      // Look ahead for vowel
      const afterCons = lower.slice(i);
      const matchedVowel = LATIN_VOWELS.find(([pat]) => afterCons.startsWith(pat));
      if (matchedVowel) {
        const [vPat, vMap] = matchedVowel;
        const matra = target === 'kn' ? vMap.knMatra : vMap.hiMatra;
        out += consChar + matra;
        i += vPat.length;
      } else {
        // No vowel follows: add virama in Kannada (or inside Hindi clusters, omit trailing halant in Hindi)
        const atEnd = i >= lower.length;
        if (target === 'kn') {
          out += consChar + '್';
        } else {
          out += atEnd ? consChar : consChar + '्';
        }
      }
      continue;
    }

    const matchedVowel = LATIN_VOWELS.find(([pat]) => rest.startsWith(pat));
    if (matchedVowel) {
      const [vPat, vMap] = matchedVowel;
      out += target === 'kn' ? vMap.knInd : vMap.hiInd;
      i += vPat.length;
      continue;
    }

    out += word[i];
    i++;
  }

  return out;
}

export function cleanDisplayPunctuation(text: string): string {
  return text.trim().replace(/[।.]+$/g, (m, offset, str) => {
    // Keep abbreviations like B.H. Road, strip single trailing period from voice STT
    const before = str.slice(0, offset);
    if (/\b[A-Za-z]$/.test(before)) return m;
    return '';
  }).trim();
}

export function localizeDisplayName(rawText: string, targetLang: SupportedLang): string {
  const cleaned = cleanDisplayPunctuation(rawText || '');
  if (!cleaned) return '';

  // First replace any exact known multi-word or single-word terms (trades & localities)
  let working = cleaned;
  for (const term of KNOWN_TERMS) {
    const targetVal = targetLang === 'kn' ? term.kn : targetLang === 'hi' ? term.hi : term.en;
    for (const variant of [term.en, term.kn, term.hi]) {
      if (variant === targetVal) continue;
      if (working.toLowerCase() === variant.toLowerCase()) {
        return targetVal;
      }
      if (working.includes(variant)) {
        working = working.split(variant).join(targetVal);
      }
    }
  }

  const tokens = working.split(/(\s+)/);
  return tokens
    .map((token) => {
      if (!token.trim()) return token;

      const hasKn = KANNADA_REGEX.test(token);
      const hasDeva = DEVANAGARI_REGEX.test(token);

      if (targetLang === 'kn') {
        if (hasKn) return token;
        if (hasDeva) return devanagariWordToKannada(token);
        return latinWordToIndic(token, 'kn');
      }

      if (targetLang === 'hi') {
        if (hasDeva) return token;
        if (hasKn) return kannadaWordToDevanagari(token);
        return latinWordToIndic(token, 'hi');
      }

      // targetLang === 'en'
      if (hasKn || hasDeva) {
        return indicWordToLatin(token);
      }
      return token;
    })
    .join('');
}
