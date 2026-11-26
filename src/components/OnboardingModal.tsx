import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  X,
  Phone,
  User,
  Briefcase,
  Building2,
  CheckCircle2,
  Volume2,
  Square,
  RotateCcw,
  Keyboard,
  ExternalLink,
  Loader2,
  LogIn,
} from 'lucide-react';
import {
  SupportedLang,
  VoiceProvider,
  MicRecordingSession,
  extractSpokenPhoneDigits,
  speakWithSarvamOrFallback,
  startSarvamMicCapture,
  transcribeAudioWithSarvam,
  stopBrowserSpeech,
} from '../services/voiceService';
import { UserAccount, findUserByPhone } from '../services/supabaseService';
import { getBrandParts, localizeDisplayName } from '../utils/transliterate';

interface OnboardingModalProps {
  isOpen: boolean;
  lang: SupportedLang;
  currentUser: UserAccount | null;
  sarvamConfigured: boolean;
  onClose: () => void;
  onSaveUser: (params: {
    name: string;
    phone: string;
    role: 'worker' | 'employer';
    area?: string;
    tradeOrBusiness?: string;
  }) => Promise<void>;
  onExistingUserLogin: (user: UserAccount) => void;
  onSignOut: () => void;
}

type QaStep = 'role' | 'name' | 'phone' | 'verify_phone' | 'details' | 'saving';
type QaPhase = 'idle' | 'speaking' | 'listening' | 'transcribing' | 'done';

interface QaMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
  provider?: VoiceProvider;
}

const AREA_OPTIONS = [
  { value: 'B.H. Road', label: 'B.H. Road', kn: 'ಬಿ.ಹೆಚ್. ರೋಡ್' },
  { value: 'Chickpet', label: 'Chickpet', kn: 'ಚಿಕ್ಕಪೇಟೆ' },
  { value: 'Kyathsandra', label: 'Kyathsandra', kn: 'ಕ್ಯಾತ್ಸಂದ್ರ' },
  { value: 'APMC Yard', label: 'APMC Yard', kn: 'ಎಪಿಎಂಸಿ ಯಾರ್ಡ್' },
  { value: 'Industrial Area', label: 'Industrial Area', kn: 'ಕೈಗಾರಿಕಾ ಪ್ರದೇಶ' },
  { value: 'Main Market', label: 'Main Market', kn: 'ಮುಖ್ಯ ಮಾರುಕಟ್ಟೆ' },
];

function cleanTranscript(text: string): string {
  return text.trim().replace(/[.。,]+$/g, '').trim();
}

function detectRoleFromSpeech(text: string): 'worker' | 'employer' | null {
  const t = text.toLowerCase();
  if (
    t.includes('employ') ||
    t.includes('hire') ||
    t.includes('staff') ||
    t.includes('owner') ||
    t.includes('shop') ||
    t.includes('business') ||
    t.includes('ಕೆಲಸಗಾರರು') ||
    t.includes('ನೇಮಿಸ') ||
    t.includes('ಅಂಗಡಿ') ||
    t.includes('मालिक') ||
    t.includes('कामगार') ||
    t.includes('दुकान')
  ) {
    return 'employer';
  }
  if (
    t.includes('work') ||
    t.includes('job') ||
    t.includes('helper') ||
    t.includes('mason') ||
    t.includes('ಕೆಲಸ') ||
    t.includes('काम') ||
    t.includes('नौकरी')
  ) {
    return 'worker';
  }
  return null;
}

function detectConfirmation(text: string): 'yes' | 'no' | null {
  const t = text.toLowerCase();
  if (
    /\b(yes|yeah|yep|correct|right|ok|okay|sure|confirm|true|haan|ha|sahi|theek)\b/.test(t) ||
    t.includes('ಹೌದು') ||
    t.includes('ಸರಿ') ||
    t.includes('हां') ||
    t.includes('सही')
  ) {
    return 'yes';
  }
  if (
    /\b(no|nope|wrong|retry|change|again|nahi|galat)\b/.test(t) ||
    t.includes('ಇಲ್ಲ') ||
    t.includes('ತಪ್ಪು') ||
    t.includes('ನहीं') ||
    t.includes('नहीं') ||
    t.includes('गलत')
  ) {
    return 'no';
  }
  return null;
}

function detectAreaFromSpeech(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('chickpet') || t.includes('ಚಿಕ್ಕಪೇಟ') || t.includes('ಚಿಕ್‌ಪೇಟ') || t.includes('चिकपेट')) {
    return 'Chickpet';
  }
  if (t.includes('kyath') || t.includes('ಕ್ಯಾತ್ಸಂದ್ರ') || t.includes('क्याथ')) {
    return 'Kyathsandra';
  }
  if (t.includes('apmc') || t.includes('ಎಪಿಎಂಸಿ') || t.includes('ಮಾರ್ಕೆಟ್') || t.includes('market')) {
    return 'APMC Yard';
  }
  if (t.includes('vasanth') || t.includes('ವಸಂತ') || t.includes('industrial') || t.includes('ಕೈಗಾರಿಕಾ')) {
    return 'Industrial Area';
  }
  if (t.includes('siddaganga') || t.includes('ಸಿದ್ಧಗಂಗಾ')) {
    return 'Siddaganga Extn';
  }
  if (t.includes('b.h') || t.includes('bh road') || t.includes('ಬಿ.ಹೆಚ್')) {
    return 'B.H. Road';
  }
  return null;
}

function getAgentScripts(lang: SupportedLang) {
  if (lang === 'kn') {
    return {
      greetRole:
        'ನಮಸ್ಕಾರ! ಕೆಲಸ ಮಿತ್ರಕ್ಕೆ ಸ್ವಾಗತ. ನಿಮಗೆ ಕೆಲಸ ಬೇಕಾ, ಅಥವಾ ಕೆಲಸಗಾರರು ಬೇಕಾ?',
      askName: (r: 'worker' | 'employer') =>
        r === 'employer'
          ? 'ಸರಿ, ನಿಮ್ಮ ಅಂಗಡಿ ಅಥವಾ ಮಾಲೀಕರ ಹೆಸರು ಏನು?'
          : 'ಸರಿ! ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಏನು?',
      askPhone: (n: string) =>
        `ಧನ್ಯವಾದಗಳು ${n}! ಈಗ ನಿಮ್ಮ ಹತ್ತು ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಹೇಳಿ.`,
      retryPhone: 'ಕ್ಷಮಿಸಿ, ಹತ್ತು ಅಂಕಿಯ ಸಂಖ್ಯೆ ಸರಿಯಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.',
      verifyPhone: (spacedDigits: string) =>
        `ನೀವು ಹೇಳಿದ ನಂಬರ್: ${spacedDigits}. ಇದು ಸರಿ ಇದೆಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.`,
      welcomeBack: (n: string) =>
        `ಮರಳಿ ಸ್ವಾಗತ ${n}! ನಿಮ್ಮ ಹಳೆಯ ಖಾತೆ ಸಿಕ್ಕಿದೆ, ಈಗ ಲಾಗಿನ್ ಆಗುತ್ತಿದ್ದೀರಿ.`,
      askDetails: (r: 'worker' | 'employer') =>
        r === 'employer'
          ? 'ತುಂಬಾ ಒಳ್ಳೆಯದು! ನೀವು ಯಾವ ಏರಿಯಾದಲ್ಲಿ ಇದ್ದೀರಿ ಮತ್ತು ಯಾವ ವ್ಯಾಪಾರ ಮಾಡುತ್ತೀರಿ?'
          : 'ತುಂಬಾ ಒಳ್ಳೆಯದು! ನೀವು ಯಾವ ಏರಿಯಾದಲ್ಲಿ ಇದ್ದೀರಿ ಮತ್ತು ಯಾವ ಕೆಲಸ ಮಾಡುತ್ತೀರಿ?',
      done: (n: string) => `ಧನ್ಯವಾದಗಳು ${n}! ನಿಮ್ಮ ಖಾತೆ ಈಗ ಸಿದ್ಧವಾಗಿದೆ.`,
    };
  }
  if (lang === 'hi') {
    return {
      greetRole:
        'नमस्ते! केलसा मित्र में आपका स्वागत है। क्या आपको काम चाहिए, या कामगार रखने हैं?',
      askName: (r: 'worker' | 'employer') =>
        r === 'employer'
          ? 'ठीक है, आपकी दुकान या मालिक का नाम क्या है?'
          : 'ठीक है! आपका पूरा नाम क्या है?',
      askPhone: (n: string) =>
        `धन्यवाद ${n}! अब अपना दस अंकों का मोबाइल नंबर बोलें।`,
      retryPhone: 'माफ़ कीजिए, दस अंक पूरे नहीं मिले। कृपया नंबर फिर से बोलें।',
      verifyPhone: (spacedDigits: string) =>
        `आपका नंबर है: ${spacedDigits}। क्या यह सही है? हाँ या नहीं बोलें।`,
      welcomeBack: (n: string) =>
        `वापसी पर स्वागत है ${n}! आपका पुराना खाता मिल गया है, लॉगिन हो रहा है।`,
      askDetails: (r: 'worker' | 'employer') =>
        r === 'employer'
          ? 'बहुत बढ़िया! आप किस इलाके में हैं और आपका कौन सा व्यवसाय है?'
          : 'बहुत बढ़िया! आप किस इलाके में हैं और आप कौन सा काम करते हैं?',
      done: (n: string) => `धन्यवाद ${n}! आपका खाता तैयार हो गया है।`,
    };
  }
  return {
    greetRole:
      'Namaskara! Welcome to KELSA Mitra. Are you looking for work, or hiring workers?',
    askName: (r: 'worker' | 'employer') =>
      r === 'employer'
        ? 'Got it! What is your name or business name?'
        : 'Great! What is your full name?',
    askPhone: (n: string) =>
      `Thanks ${n}! Now please tell me your 10-digit mobile number.`,
    retryPhone: 'Sorry, I did not catch all 10 digits. Please say your mobile number again.',
    verifyPhone: (spacedDigits: string) =>
      `I heard ${spacedDigits}. Is this number correct? Say Yes or No.`,
    welcomeBack: (n: string) =>
      `Welcome back, ${n}! Found your existing account and logging you in now.`,
    askDetails: (r: 'worker' | 'employer') =>
      r === 'employer'
        ? 'Perfect! Which area are you in, and what is your business?'
        : 'Perfect! Which area are you in, and what work do you do?',
    done: (n: string) => `Thank you ${n}! Your account is verified and ready.`,
  };
}

export default function OnboardingModal({
  isOpen,
  lang,
  currentUser,
  sarvamConfigured,
  onClose,
  onSaveUser,
  onExistingUserLogin,
  onSignOut,
}: OnboardingModalProps) {
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [role, setRole] = useState<'worker' | 'employer'>(currentUser?.role || 'worker');
  const [area, setArea] = useState(currentUser?.area || 'B.H. Road');
  const [tradeOrBusiness, setTradeOrBusiness] = useState(currentUser?.tradeOrBusiness || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [micPermissionBlocked, setMicPermissionBlocked] = useState(false);

  // Returning-user login state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginListening, setLoginListening] = useState(false);

  // Continuous Conversational Q&A vs Existing User Login vs Manual Form
  const [mode, setMode] = useState<'qa' | 'login' | 'manual'>('qa');
  const [qaStep, setQaStep] = useState<QaStep>('role');
  const [qaPhase, setQaPhase] = useState<QaPhase>('idle');
  const [qaMessages, setQaMessages] = useState<QaMessage[]>([]);
  const [manualEntryValue, setManualEntryValue] = useState('');
  const [activeProvider, setActiveProvider] = useState<VoiceProvider>(
    sarvamConfigured ? 'sarvam' : 'builtin'
  );

  const cancelSignalRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const micSessionRef = useRef<MicRecordingSession | null>(null);
  const browserRecRef = useRef<{ stop: () => void } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const roleRef = useRef(role);
  const nameRef = useRef(name);
  const phoneRef = useRef(phone);
  const areaRef = useRef(area);
  const tradeRef = useRef(tradeOrBusiness);
  const langRef = useRef(lang);
  const sarvamConfiguredRef = useRef(sarvamConfigured);

  useEffect(() => {
    roleRef.current = role;
    nameRef.current = name;
    phoneRef.current = phone;
    areaRef.current = area;
    tradeRef.current = tradeOrBusiness;
    langRef.current = lang;
    sarvamConfiguredRef.current = sarvamConfigured;
  }, [role, name, phone, area, tradeOrBusiness, lang, sarvamConfigured]);

  useEffect(() => {
    setActiveProvider(sarvamConfigured ? 'sarvam' : 'builtin');
  }, [sarvamConfigured]);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setPhone(currentUser.phone);
      setRole(currentUser.role);
      setArea((currentUser.area || 'B.H. Road').replace(/,\s*Tumakuru/gi, '').trim());
      setTradeOrBusiness(currentUser.tradeOrBusiness || '');
    } else {
      setName('');
      setPhone('');
      setRole('worker');
      setArea('B.H. Road');
      setTradeOrBusiness('');
    }
    setError('');
    setMicPermissionBlocked(false);
    setQaMessages([]);
    setQaStep('role');
    setQaPhase('idle');
    setManualEntryValue('');
    setLoginPhone('');
    setLoginListening(false);
  }, [currentUser, isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaMessages, qaPhase]);

  const stopAllAudio = () => {
    cancelSignalRef.current.cancelled = true;
    stopBrowserSpeech();
    try {
      micSessionRef.current?.stop();
    } catch {
      // Ignore
    }
    micSessionRef.current = null;
    try {
      browserRecRef.current?.stop();
    } catch {
      // Ignore
    }
    browserRecRef.current = null;
    setLoginListening(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopAllAudio();
    }
    return () => {
      stopAllAudio();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const pushMessage = (
    sender: 'agent' | 'user',
    text: string,
    provider: VoiceProvider = activeProvider
  ) => {
    setQaMessages((prev) => [
      ...prev,
      {
        id: `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        sender,
        text,
        provider,
      },
    ]);
  };

  const speakAndThen = async (text: string, onDone: () => void) => {
    if (cancelSignalRef.current.cancelled) return;
    setQaPhase('speaking');
    const msgId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const initialProvider: VoiceProvider = sarvamConfiguredRef.current ? 'sarvam' : 'builtin';

    setQaMessages((prev) => [
      ...prev,
      { id: msgId, sender: 'agent', text, provider: initialProvider },
    ]);

    const result = await speakWithSarvamOrFallback(
      text,
      langRef.current,
      cancelSignalRef.current
    );

    if (cancelSignalRef.current.cancelled) return;

    setActiveProvider(result.provider);
    setQaMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, provider: result.provider } : m))
    );

    onDone();
  };

  const listenWithBrowserFallback = (onTranscript: (transcript: string) => void) => {
    if (cancelSignalRef.current.cancelled) return;
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: (e: { error?: string }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: (e: { error?: string }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setQaPhase('idle');
      setError('Mic recognition is unavailable in this browser. Answer using the quick buttons or text box below.');
      return;
    }

    try {
      const rec = new SpeechRec();
      const activeLang = langRef.current;
      rec.lang = activeLang === 'kn' ? 'kn-IN' : activeLang === 'hi' ? 'hi-IN' : 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let gotResult = false;
      setQaPhase('listening');

      rec.onresult = (event) => {
        const spoken = event.results?.[0]?.[0]?.transcript?.trim() || '';
        if (spoken && !cancelSignalRef.current.cancelled) {
          gotResult = true;
          pushMessage('user', spoken, 'builtin');
          onTranscript(spoken);
        }
      };

      rec.onerror = (ev) => {
        if (cancelSignalRef.current.cancelled) return;
        const code = ev?.error || '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setMicPermissionBlocked(true);
          setError(
            'Microphone access is blocked in this preview frame or browser tab. Open in a new tab to grant Mic permission, or answer using the quick buttons / text box above.'
          );
        }
        setQaPhase('idle');
      };

      rec.onend = () => {
        if (!gotResult && !cancelSignalRef.current.cancelled) {
          setQaPhase('idle');
        }
      };

      browserRecRef.current = rec;
      rec.start();
    } catch {
      setQaPhase('idle');
    }
  };

  const listenForAnswer = (onTranscript: (transcript: string) => void) => {
    if (cancelSignalRef.current.cancelled) return;

    if (!sarvamConfiguredRef.current) {
      listenWithBrowserFallback(onTranscript);
      return;
    }

    setMicPermissionBlocked(false);
    micSessionRef.current = startSarvamMicCapture({
      maxDurationMs: 8500,
      silenceDurationMs: 1500,
      onStatusChange: (phase) => {
        if (!cancelSignalRef.current.cancelled) {
          setQaPhase(phase);
        }
      },
      onAudioCaptured: async (blob) => {
        if (cancelSignalRef.current.cancelled) return;
        setQaPhase('transcribing');
        const res = await transcribeAudioWithSarvam(blob, langRef.current);
        if (cancelSignalRef.current.cancelled) return;

        if (res.transcript) {
          setActiveProvider('sarvam');
          pushMessage('user', res.transcript, 'sarvam');
          onTranscript(res.transcript);
        } else {
          setQaPhase('idle');
          setError(res.errorMessage || 'Could not hear clearly. Tap Speak Answer and try again, or type below.');
        }
      },
      onError: (code, message) => {
        if (cancelSignalRef.current.cancelled) return;
        setQaPhase('idle');
        if (code === 'MIC_PERMISSION_DENIED') {
          setMicPermissionBlocked(true);
        }
        setError(message);
      },
    });
  };

  // Continuous Step Handlers
  const runRoleStep = () => {
    setQaStep('role');
    setError('');
    const scripts = getAgentScripts(langRef.current);
    speakAndThen(scripts.greetRole, () => {
      listenForAnswer((spoken) => {
        const detected = detectRoleFromSpeech(spoken) || 'worker';
        handleRoleAnswer(detected);
      });
    });
  };

  const handleRoleAnswer = (selectedRole: 'worker' | 'employer') => {
    try {
      micSessionRef.current?.stop();
      browserRecRef.current?.stop();
    } catch {
      // Ignore
    }
    setRole(selectedRole);
    roleRef.current = selectedRole;
    setManualEntryValue('');
    runNameStep(selectedRole);
  };

  const runNameStep = (selectedRole: 'worker' | 'employer') => {
    setQaStep('name');
    setError('');
    const scripts = getAgentScripts(langRef.current);
    speakAndThen(scripts.askName(selectedRole), () => {
      listenForAnswer((spoken) => {
        handleNameAnswer(spoken);
      });
    });
  };

  const handleNameAnswer = (spokenName: string) => {
    const clean = cleanTranscript(spokenName);
    if (!clean) return;
    try {
      micSessionRef.current?.stop();
      browserRecRef.current?.stop();
    } catch {
      // Ignore
    }
    setName(clean);
    nameRef.current = clean;
    setManualEntryValue('');
    runPhoneStep(clean, false);
  };

  const runPhoneStep = (userName: string, isRetry: boolean) => {
    setQaStep('phone');
    setError('');
    const scripts = getAgentScripts(langRef.current);
    const prompt = isRetry ? scripts.retryPhone : scripts.askPhone(userName);
    speakAndThen(prompt, () => {
      listenForAnswer((spoken) => {
        handlePhoneAnswer(spoken);
      });
    });
  };

  const handlePhoneAnswer = (spokenPhone: string) => {
    try {
      micSessionRef.current?.stop();
      browserRecRef.current?.stop();
    } catch {
      // Ignore
    }
    const digits = extractSpokenPhoneDigits(spokenPhone);
    if (digits.length !== 10) {
      runPhoneStep(nameRef.current, true);
      return;
    }
    setPhone(digits);
    phoneRef.current = digits;
    setManualEntryValue('');
    runVerifyPhoneStep(digits);
  };

  const runVerifyPhoneStep = (digits: string) => {
    setQaStep('verify_phone');
    setError('');
    const scripts = getAgentScripts(langRef.current);
    const spaced = digits.split('').join(' ');
    speakAndThen(scripts.verifyPhone(spaced), () => {
      listenForAnswer((spoken) => {
        const verdict = detectConfirmation(spoken);
        if (verdict === 'no') {
          runPhoneStep(nameRef.current, true);
        } else {
          handleConfirmPhone(true);
        }
      });
    });
  };

  const handleConfirmPhone = async (confirmed: boolean) => {
    try {
      micSessionRef.current?.stop();
      browserRecRef.current?.stop();
    } catch {
      // Ignore
    }
    if (!confirmed) {
      runPhoneStep(nameRef.current, true);
      return;
    }

    // Check if an existing user already owns this phone number!
    const existing = await findUserByPhone(phoneRef.current);
    if (existing) {
      setQaStep('saving');
      setQaPhase('done');
      const scripts = getAgentScripts(langRef.current);
      onExistingUserLogin(existing);
      await speakAndThen(scripts.welcomeBack(existing.name), () => {
        setQaPhase('done');
      });
      return;
    }

    runDetailsStep();
  };

  const runDetailsStep = () => {
    setQaStep('details');
    setError('');
    const scripts = getAgentScripts(langRef.current);
    speakAndThen(scripts.askDetails(roleRef.current), () => {
      listenForAnswer((spoken) => {
        handleDetailsAnswer(spoken);
      });
    });
  };

  const handleDetailsAnswer = (spokenDetails: string) => {
    try {
      micSessionRef.current?.stop();
      browserRecRef.current?.stop();
    } catch {
      // Ignore
    }
    const cleanDetails = cleanTranscript(spokenDetails);
    const matchedArea = detectAreaFromSpeech(cleanDetails);
    const finalArea = matchedArea || areaRef.current || 'B.H. Road';
    const finalTrade =
      cleanDetails ||
      (roleRef.current === 'employer' ? 'Local Business' : 'Daily Shift Worker');

    setArea(finalArea);
    setTradeOrBusiness(finalTrade);
    areaRef.current = finalArea;
    tradeRef.current = finalTrade;
    finalizeQaAccount(finalArea, finalTrade);
  };

  const finalizeQaAccount = async (finalArea: string, finalTrade: string) => {
    setQaStep('saving');
    setSaving(true);
    const scripts = getAgentScripts(langRef.current);
    try {
      await onSaveUser({
        name: cleanTranscript(nameRef.current) || 'New User',
        phone: phoneRef.current,
        role: roleRef.current,
        area: finalArea,
        tradeOrBusiness: finalTrade,
      });
      setQaPhase('done');
      await speakAndThen(scripts.done(nameRef.current || ''), () => {
        setQaPhase('done');
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStartContinuousQa = () => {
    stopAllAudio();
    cancelSignalRef.current = { cancelled: false };
    setQaMessages([]);
    setError('');
    setMicPermissionBlocked(false);
    runRoleStep();
  };

  const handleTapSpeakCurrentStep = () => {
    if (qaPhase === 'listening') {
      try {
        micSessionRef.current?.stop();
        browserRecRef.current?.stop();
      } catch {
        // Ignore
      }
      return;
    }
    cancelSignalRef.current = { cancelled: false };
    stopBrowserSpeech();
    setError('');
    if (qaStep === 'role') {
      listenForAnswer((spoken) => {
        handleRoleAnswer(detectRoleFromSpeech(spoken) || 'worker');
      });
    } else if (qaStep === 'name') {
      listenForAnswer((spoken) => handleNameAnswer(spoken));
    } else if (qaStep === 'phone') {
      listenForAnswer((spoken) => handlePhoneAnswer(spoken));
    } else if (qaStep === 'verify_phone') {
      listenForAnswer((spoken) => {
        const verdict = detectConfirmation(spoken);
        handleConfirmPhone(verdict !== 'no');
      });
    } else if (qaStep === 'details') {
      listenForAnswer((spoken) => handleDetailsAnswer(spoken));
    }
  };

  const handleManualStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualEntryValue.trim();
    if (!val) return;
    pushMessage('user', val);
    if (qaStep === 'name') {
      handleNameAnswer(val);
    } else if (qaStep === 'phone') {
      const digits = extractSpokenPhoneDigits(val);
      if (digits.length !== 10) {
        setError('Please enter a 10-digit mobile number.');
        return;
      }
      handlePhoneAnswer(digits);
    } else if (qaStep === 'details') {
      handleDetailsAnswer(val);
    }
  };

  const handleExistingLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = extractSpokenPhoneDigits(loginPhone);
    if (digits.length !== 10) {
      setError('Please enter or speak your 10-digit mobile number.');
      return;
    }
    setError('');
    setLoginBusy(true);
    try {
      const found = await findUserByPhone(digits);
      if (found) {
        onExistingUserLogin(found);
      } else {
        setPhone(digits);
        setError('No existing account found for +91 ' + digits + '. Tap "Create New Account" below to register in seconds.');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleVoiceLoginSpeak = () => {
    if (loginListening) {
      try {
        micSessionRef.current?.stop();
      } catch {
        // Ignore
      }
      setLoginListening(false);
      return;
    }
    setError('');
    setMicPermissionBlocked(false);
    cancelSignalRef.current = { cancelled: false };
    setLoginListening(true);

    micSessionRef.current = startSarvamMicCapture({
      maxDurationMs: 7000,
      silenceDurationMs: 1400,
      onAudioCaptured: async (blob) => {
        setLoginListening(false);
        setLoginBusy(true);
        const res = await transcribeAudioWithSarvam(blob, langRef.current);
        const digits = extractSpokenPhoneDigits(res.transcript || '');
        if (digits.length === 10) {
          setLoginPhone(digits);
          const found = await findUserByPhone(digits);
          if (found) {
            onExistingUserLogin(found);
          } else {
            setPhone(digits);
            setError('No existing account found for +91 ' + digits + '. Create a new account below.');
          }
        } else {
          setError('Could not catch all 10 digits. Please type or speak your number clearly.');
        }
        setLoginBusy(false);
      },
      onError: (code, msg) => {
        setLoginListening(false);
        if (code === 'MIC_PERMISSION_DENIED') setMicPermissionBlocked(true);
        setError(msg);
      },
    });
  };

  const handleManualFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = phone.replace(/\D/g, '');
    if (!name.trim()) {
      setError(lang === 'kn' ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರು ನಮೂದಿಸಿ' : 'Please enter your full name.');
      return;
    }
    if (digitsOnly.length !== 10) {
      setError(lang === 'kn' ? '10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ' : 'Enter a valid 10-digit mobile number.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await onSaveUser({
        name: cleanTranscript(name),
        phone: digitsOnly,
        role,
        area: area.trim() || 'B.H. Road',
        tradeOrBusiness:
          tradeOrBusiness.trim() ||
          (role === 'employer' ? 'Local Business' : 'Daily Shift Worker'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    stopAllAudio();
    onClose();
  };

  const isHdVoiceActive = activeProvider === 'sarvam' && sarvamConfigured;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto"
        >
          <div className="w-10 h-1.5 bg-stone-300 rounded-full mx-auto mb-4 sm:hidden" />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#14171A] tracking-tight">
                {currentUser
                  ? lang === 'kn'
                    ? 'ನಿಮ್ಮ ಖಾತೆ ವಿವರ'
                    : lang === 'hi'
                    ? `आपका ${getBrandParts(lang).full} खाता`
                    : `Your ${getBrandParts(lang).full} Account`
                  : mode === 'login'
                  ? lang === 'kn'
                    ? 'ಹಳೆಯ ಖಾತೆಗೆ ಲಾಗಿನ್'
                    : lang === 'hi'
                    ? 'मौजूदा खाते में लॉगिन करें'
                    : 'Log In to Existing Account'
                  : lang === 'kn'
                  ? 'ಮಾತನಾಡಿ ಖಾತೆ ತೆರೆಯಿರಿ'
                  : lang === 'hi'
                  ? 'बोलकर साइन इन करें (Voice Q&A)'
                  : 'Sign In (Voice Q&A)'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {mode === 'qa'
                  ? 'Guided voice sign-in in Kannada, Hindi, or English'
                  : mode === 'login'
                  ? 'Enter or speak your registered 10-digit mobile number'
                  : 'Quick manual entry for workers & local businesses'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              className="p-2 text-stone-400 hover:text-[#14171A] rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              aria-label="Close onboarding"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Clean 2-Way Switch: New Account vs Existing User Login */}
          <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-xl mb-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                stopAllAudio();
                setError('');
                setMode('qa');
              }}
              className={`py-2 rounded-lg transition cursor-pointer ${
                mode === 'qa' || mode === 'manual'
                  ? 'bg-white text-[#14171A] shadow-xs'
                  : 'text-stone-600 hover:text-[#14171A]'
              }`}
            >
              New Account
            </button>
            <button
              type="button"
              onClick={() => {
                stopAllAudio();
                setError('');
                setMode('login');
              }}
              className={`py-2 rounded-lg transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-white text-[#14171A] shadow-xs'
                  : 'text-stone-600 hover:text-[#14171A]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 text-[#059669]" />
              <span>Existing Login</span>
            </button>
          </div>

          {mode === 'login' ? (
            /* ================= RETURNING USER 1-STEP PHONE LOGIN ================= */
            <form onSubmit={handleExistingLoginSubmit} className="space-y-4">
              <div className="bg-[#FAF8F5] border border-stone-200 rounded-2xl p-4 space-y-3">
                <label className="block text-xs font-extrabold text-[#14171A]">
                  Registered 10-Digit Mobile Number
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9845012345"
                      className="w-full min-h-[46px] pl-10 pr-4 bg-white border border-stone-200 rounded-xl text-sm font-bold tabular-nums tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVoiceLoginSpeak}
                    className={`min-h-[46px] px-3.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition ${
                      loginListening
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-[#F59E0B] text-[#14171A] hover:bg-amber-400'
                    }`}
                    title="Speak your phone number"
                  >
                    <Mic className="w-4 h-4" />
                    <span>{loginListening ? 'Stop' : 'Speak'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  Your saved profile, role, jobs count, and requirements are restored automatically.
                </p>
              </div>

              {error && (
                <div className="text-xs font-bold text-rose-700 bg-rose-50 px-3.5 py-2.5 rounded-xl border border-rose-200 space-y-2">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setMode('manual');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14171A] text-white text-[11px] font-extrabold cursor-pointer"
                  >
                    Create New Account with this Number →
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full min-h-[48px] bg-[#14171A] hover:bg-stone-800 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>{loginBusy ? 'Checking Account...' : 'Log In'}</span>
              </button>
            </form>
          ) : mode === 'qa' ? (
            /* ================= CONTINUOUS VOICE Q&A FLOW ================= */
            <div className="space-y-4">
              {/* Top Rectangular Status Box: GREEN when HD Voice is active, GREY when Standard Voice */}
              <div
                className={`rounded-2xl p-4 space-y-3 text-white transition-colors border ${
                  isHdVoiceActive
                    ? 'bg-[#059669] border-emerald-400'
                    : 'bg-stone-600 border-stone-500'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        qaPhase === 'listening'
                          ? 'bg-[#EA580C] text-white animate-pulse'
                          : qaPhase === 'transcribing'
                          ? 'bg-amber-400 text-[#14171A]'
                          : isHdVoiceActive
                          ? 'bg-emerald-900/50 text-white'
                          : qaPhase === 'speaking'
                          ? 'bg-stone-800 text-white'
                          : 'bg-[#F59E0B] text-[#14171A]'
                      }`}
                    >
                      {qaPhase === 'transcribing' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : qaPhase === 'speaking' ? (
                        <Volume2 className="w-5 h-5 animate-pulse" />
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isHdVoiceActive
                              ? 'bg-emerald-900/60 text-emerald-100'
                              : 'bg-stone-800/80 text-stone-200'
                          }`}
                        >
                          {isHdVoiceActive ? 'HD Voice Active' : 'Standard Voice'}
                        </span>
                      </div>
                      <p className="text-xs font-extrabold">
                        {qaPhase === 'speaking'
                          ? 'Voice assistant is speaking...'
                          : qaPhase === 'listening'
                          ? 'Listening — speak now (tap Done when finished)...'
                          : qaPhase === 'transcribing'
                          ? 'Processing your answer...'
                          : qaPhase === 'done'
                          ? 'Account Verified & Ready!'
                          : qaMessages.length === 0
                          ? 'Tap Start for Guided Voice Q&A'
                          : 'Tap Mic to answer or use quick buttons'}
                      </p>
                      <p className="text-[11px] text-white/80">
                        Role → Name → Phone Verify → Area & Work
                      </p>
                    </div>
                  </div>

                  {qaMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleStartContinuousQa}
                      className="p-2 rounded-xl bg-black/25 hover:bg-black/40 text-white cursor-pointer"
                      title="Restart Q&A"
                      aria-label="Restart Q&A"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Live 1-Tap Start / Stop / Speak Control */}
                {qaMessages.length === 0 ? (
                  <button
                    type="button"
                    onClick={handleStartContinuousQa}
                    className="w-full min-h-[48px] bg-gradient-to-r from-[#F59E0B] to-[#EA580C] text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Mic className="w-5 h-5" />
                    <span>
                      {lang === 'kn'
                        ? 'ಪ್ರಾರಂಭಿಸಿ (Start Voice Q&A)'
                        : lang === 'hi'
                        ? 'शुरू करें (Start Voice Q&A)'
                        : 'Start Voice Sign-In Q&A'}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={qaPhase === 'transcribing' || qaPhase === 'speaking'}
                      onClick={handleTapSpeakCurrentStep}
                      className={`flex-1 min-h-[44px] rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60 ${
                        qaPhase === 'listening'
                          ? 'bg-rose-600 text-white'
                          : 'bg-[#F59E0B] text-[#14171A] hover:bg-amber-400'
                      }`}
                    >
                      {qaPhase === 'listening' ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      <span>
                        {qaPhase === 'listening'
                          ? 'Done Speaking (Send)'
                          : qaPhase === 'transcribing'
                          ? 'Processing...'
                          : 'Tap to Speak Answer'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={stopAllAudio}
                      className="min-h-[44px] px-3.5 rounded-xl bg-black/25 hover:bg-black/40 text-xs font-bold text-white cursor-pointer"
                    >
                      Pause
                    </button>
                  </div>
                )}
              </div>

              {/* Live Q&A Conversation Transcript */}
              {qaMessages.length > 0 && (
                <div className="bg-[#FAF8F5] border border-stone-200 rounded-2xl p-3.5 max-h-48 overflow-y-auto space-y-2.5">
                  {qaMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          m.sender === 'user'
                            ? 'bg-[#14171A] text-white font-semibold'
                            : 'bg-white border border-stone-200 text-[#14171A] font-bold'
                        }`}
                      >
                        {m.sender === 'agent' && (
                          <span
                            className={`block text-[10px] font-extrabold mb-0.5 ${
                              m.provider === 'sarvam' ? 'text-[#059669]' : 'text-stone-500'
                            }`}
                          >
                            {m.provider === 'sarvam' ? 'HD Voice Assistant' : 'Standard Voice'}
                          </span>
                        )}
                        {m.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* Contextual One-Tap Controls for Current Step */}
              {qaMessages.length > 0 && qaStep === 'role' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      pushMessage('user', lang === 'kn' ? 'ಕೆಲಸ ಬೇಕು (Worker)' : 'Worker');
                      handleRoleAnswer('worker');
                    }}
                    className="p-3 rounded-2xl border-2 border-[#EA580C]/40 bg-amber-50/70 hover:bg-amber-100/70 text-left cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4 text-[#EA580C] mb-1" />
                    <span className="text-xs font-extrabold text-[#14171A] block">
                      {lang === 'kn' ? 'ಕೆಲಸ ಬೇಕು' : 'Need Work (Worker)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pushMessage('user', lang === 'kn' ? 'ಕೆಲಸಗಾರರು ಬೇಕು (Employer)' : 'Employer');
                      handleRoleAnswer('employer');
                    }}
                    className="p-3 rounded-2xl border-2 border-[#2563EB]/40 bg-blue-50/70 hover:bg-blue-100/70 text-left cursor-pointer"
                  >
                    <Building2 className="w-4 h-4 text-[#2563EB] mb-1" />
                    <span className="text-xs font-extrabold text-[#14171A] block">
                      {lang === 'kn' ? 'ಕೆಲಸಗಾರರು ಬೇಕು' : 'Hire Staff (Employer)'}
                    </span>
                  </button>
                </div>
              )}

              {qaMessages.length > 0 && qaStep === 'verify_phone' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-2.5">
                  <p className="text-xs font-bold text-emerald-900">
                    Verify Mobile Number: <span className="text-sm font-extrabold tabular-nums">+91 {phone}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        pushMessage('user', 'Yes, correct');
                        handleConfirmPhone(true);
                      }}
                      className="min-h-[42px] rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                    >
                      Yes, Correct ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pushMessage('user', 'No, re-enter');
                        handleConfirmPhone(false);
                      }}
                      className="min-h-[42px] rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-bold cursor-pointer"
                    >
                      No, Say Again
                    </button>
                  </div>
                </div>
              )}

              {qaMessages.length > 0 &&
                (qaStep === 'name' || qaStep === 'phone' || qaStep === 'details') && (
                  <form onSubmit={handleManualStepSubmit} className="flex items-center gap-2">
                    <input
                      type={qaStep === 'phone' ? 'tel' : 'text'}
                      inputMode={qaStep === 'phone' ? 'numeric' : 'text'}
                      value={manualEntryValue}
                      onChange={(e) => setManualEntryValue(e.target.value)}
                      placeholder={
                        qaStep === 'name'
                          ? 'Or type name...'
                          : qaStep === 'phone'
                          ? 'Or type 10-digit number...'
                          : 'Or type area & skill...'
                      }
                      className="flex-1 min-h-[42px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="submit"
                      className="min-h-[42px] px-4 rounded-xl bg-[#14171A] text-white text-xs font-bold cursor-pointer"
                    >
                      Send
                    </button>
                  </form>
                )}

              {/* Collected Live Summary Strip */}
              {(name || phone) && (
                <div className="bg-stone-100/80 rounded-xl px-3.5 py-2.5 text-[11px] text-stone-700 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Role: <strong className="text-[#14171A]">{role}</strong></span>
                  {name && <span>Name: <strong className="text-[#14171A]">{localizeDisplayName(name, lang)}</strong></span>}
                  {phone && <span>Phone: <strong className="text-[#059669] tabular-nums">{phone}</strong></span>}
                </div>
              )}

              {error && (
                <div className="text-xs font-bold text-rose-700 bg-rose-50 px-3.5 py-2.5 rounded-xl border border-rose-200 leading-relaxed space-y-2">
                  <p>{error}</p>
                  {micPermissionBlocked && typeof window !== 'undefined' && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 text-white text-[11px] font-extrabold hover:bg-rose-800 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in New Tab to Unlock Mic</span>
                    </a>
                  )}
                </div>
              )}

              {/* Secondary Links */}
              <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    stopAllAudio();
                    setMode('manual');
                  }}
                  className="text-stone-600 hover:text-[#14171A] font-bold inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Type Manually Instead</span>
                </button>

                <span
                  className={`text-[11px] font-bold ${
                    sarvamConfigured ? 'text-[#059669]' : 'text-stone-500'
                  }`}
                >
                  {sarvamConfigured ? 'HD Voice Ready' : 'Standard Mode'}
                </span>
              </div>
            </div>
          ) : (
            /* ================= FALLBACK MANUAL FORM ================= */
            <form onSubmit={handleManualFormSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole('worker')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                    role === 'worker'
                      ? 'border-[#EA580C] bg-amber-50/70'
                      : 'border-stone-200 bg-[#FAF8F5] hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Briefcase className={`w-4 h-4 ${role === 'worker' ? 'text-[#EA580C]' : 'text-stone-500'}`} />
                    {role === 'worker' && <CheckCircle2 className="w-4 h-4 text-[#EA580C]" />}
                  </div>
                  <span className="text-xs font-extrabold text-[#14171A] block">
                    {lang === 'kn' ? 'ನನಗೆ ಕೆಲಸ ಬೇಕು' : 'Worker'}
                  </span>
                  <span className="text-[11px] text-stone-500 block">Find daily shifts</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('employer')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                    role === 'employer'
                      ? 'border-[#2563EB] bg-blue-50/70'
                      : 'border-stone-200 bg-[#FAF8F5] hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Building2 className={`w-4 h-4 ${role === 'employer' ? 'text-[#2563EB]' : 'text-stone-500'}`} />
                    {role === 'employer' && <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />}
                  </div>
                  <span className="text-xs font-extrabold text-[#14171A] block">
                    {lang === 'kn' ? 'ಕೆಲಸಗಾರರು ಬೇಕು' : 'Employer'}
                  </span>
                  <span className="text-[11px] text-stone-500 block">Hire local help</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {role === 'employer' ? 'Owner / Shop Name' : 'Full Name'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar / Sri Vinayaka Garage"
                    className="w-full min-h-[44px] pl-10 pr-4 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  10-Digit Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9845012345"
                    className="w-full min-h-[44px] pl-10 pr-4 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-bold tabular-nums tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Work Area</label>
                  <input
                    type="text"
                    list="onboarding-area-options"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Chickpet"
                    className="w-full min-h-[42px] px-3 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                  <datalist id="onboarding-area-options">
                    {AREA_OPTIONS.map((loc) => (
                      <option key={loc.value} value={loc.value}>
                        {lang === 'kn' ? loc.kn : loc.label}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {role === 'employer' ? 'Business Type' : 'Primary Skill'}
                  </label>
                  <input
                    type="text"
                    value={tradeOrBusiness}
                    onChange={(e) => setTradeOrBusiness(e.target.value)}
                    placeholder={role === 'employer' ? 'Hardware Shop' : 'Mason / Electrician'}
                    className="w-full min-h-[42px] px-3 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[48px] bg-[#14171A] hover:bg-stone-800 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl transition cursor-pointer"
                >
                  {saving ? 'Saving...' : currentUser ? 'Update Account' : 'Continue'}
                </button>

                {currentUser && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="min-h-[48px] px-4 rounded-2xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                  >
                    Switch
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMode('qa')}
                className="w-full text-center text-xs font-bold text-[#EA580C] hover:underline pt-1 cursor-pointer"
              >
                ← Back to Guided Voice Q&A
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
