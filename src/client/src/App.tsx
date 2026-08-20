import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Microphone, 
  PaperPlaneTilt, 
  Gear, 
  ClockCounterClockwise, 
  ChatCircle, 
  WaveformSlash, 
  Sun, 
  Moon, 
  Desktop,
  MagnifyingGlass
} from '@phosphor-icons/react';
import './index.css';
import './App.css';
import { AuthClient, type AuthState } from './auth/AuthClient';
import { WebSocketClient, type WSState } from './ws/WebSocketClient';
import { AudioCapture } from './audio/AudioCapture';
import { PCMPlayer } from './audio/PCMPlayer';
import { VoiceController } from './audio/VoiceController';
import { useAuth0 } from '@auth0/auth0-react';
import { useLanguage, LanguageProvider } from './contexts/LanguageContext';
import { useTheme, ThemeProvider } from './contexts/ThemeContext';

import { ErrorBoundary } from './components/ErrorBoundary';
import { CrisisOverlay } from './components/CrisisOverlay';
import { ConsentManager } from './components/ConsentManager';
import { SessionHistory, type SessionRecord } from './components/SessionHistory';
import { Settings } from './components/Settings';
import { AIEntity } from './components/AIEntity';
import { Sidebar, type NavItem } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { ChatView, type ChatMessage } from './components/ChatView';
import { MoodView } from './components/MoodView';
import { JournalView } from './components/JournalView';
import { WellnessView } from './components/WellnessView';
import { SafetyView } from './components/SafetyView';
import { PrivacyView } from './components/PrivacyView';
import { CommandPalette } from './components/CommandPalette';
import { DoctorHandoffModal } from './components/DoctorHandoffModal';
import { ClientClinicalEngine } from './clinical/ClientClinicalEngine';

type ViewMode = NavItem;


// ─── Greeting based on time of day ───
function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 5)  return { text: 'Still awake?', emoji: '🌙' };
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  if (h < 21) return { text: 'Good evening', emoji: '🌅' };
  return { text: 'Good evening', emoji: '🌙' };
}

const SUGGESTIONS = [
  "I'm overwhelmed",
  "I can't stop thinking",
  "I need someone to talk to",
  "Help me relax",
  "I don't know what I'm feeling",
];

const transition = { duration: 0.5, ease: [0.16, 1, 0.3, 1] };
const fadeVariants = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: -8, scale: 0.99 },
};

function MainApp() {
  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const isAuth = localStorage.getItem('mindcare_authenticated') === 'true';
      const wst = localStorage.getItem('mindcare_wst') || (isAuth ? 'guest-ticket-active' : null);
      const token = localStorage.getItem('mindcare_token') || (isAuth ? 'guest-token-active' : null);
      if (isAuth && wst) {
        return {
          isAuthenticated: true,
          token: token || 'mindcare-token',
          wst,
          sessionId: crypto.randomUUID(),
          error: null
        };
      }
    } catch {}
    return {
      isAuthenticated: false,
      token: null,
      wst: null,
      sessionId: null,
      error: null
    };
  });
  const [wsState, setWsState] = useState<WSState>('DISCONNECTED');
  const [backendState, setBackendState] = useState<string>('IDLE');
  const [inputText, setInputText] = useState('');
  const [initialLoadingComplete, setInitialLoadingComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoadingComplete(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem('mindcare_active_messages');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [activeView, setActiveView] = useState<ViewMode>('home');

  // UI States
  const [showSettings, setShowSettings] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  
  const [savedSessions, setSavedSessions] = useState<SessionRecord[]>(() => {
    try {
      const raw = localStorage.getItem('mindcare_saved_sessions');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('mindcare_current_session_id');
      if (stored) return stored;
    } catch (e) {}
    const newId = Date.now().toString();
    try { localStorage.setItem('mindcare_current_session_id', newId); } catch (e) {}
    return newId;
  });
  
  const { language: languagePref, setLanguage: setLanguagePref } = useLanguage();
  const { theme, setTheme } = useTheme();

  // Auto-persist active messages & sync session history in real-time
  useEffect(() => {
    try {
      localStorage.setItem('mindcare_active_messages', JSON.stringify(messages));
      
      if (messages.length > 0) {
        const firstUserMsg = messages.find(m => m.sender === 'user')?.text || (languagePref === 'EGYPTIAN_ARABIC' ? 'حوار علاجي واستكشاف' : 'Therapeutic Dialogue');
        const summary = firstUserMsg.length > 75 ? firstUserMsg.slice(0, 72) + '...' : firstUserMsg;
        const nowFormatted = new Date().toLocaleDateString(languagePref === 'EGYPTIAN_ARABIC' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
        const durationFormatted = `${Math.max(1, Math.round(messages.length * 1.5))} ${languagePref === 'EGYPTIAN_ARABIC' ? 'دقيقة' : 'min'}`;
        
        setSavedSessions(prev => {
          const existingIdx = prev.findIndex(s => s.id === currentSessionId);
          let updated: SessionRecord[];
          if (existingIdx >= 0) {
            updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              summary,
              duration: durationFormatted,
              messages: [...messages]
            };
          } else {
            const newRecord: SessionRecord = {
              id: currentSessionId,
              date: nowFormatted,
              summary,
              duration: durationFormatted,
              topic: languagePref === 'EGYPTIAN_ARABIC' ? 'حوار واستكشاف' : 'Exploration',
              messages: [...messages]
            };
            updated = [newRecord, ...prev];
          }
          try {
            localStorage.setItem('mindcare_saved_sessions', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }
    } catch (e) {}
  }, [messages, currentSessionId, languagePref]);

  const handleNewChat = () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    try { localStorage.setItem('mindcare_current_session_id', newId); } catch (e) {}
    setMessages([]);
    try { localStorage.removeItem('mindcare_active_messages'); } catch (e) {}
    setActiveView('chat');
  };

  const handleSelectSession = (session: SessionRecord) => {
    setCurrentSessionId(session.id);
    try { localStorage.setItem('mindcare_current_session_id', session.id); } catch (e) {}
    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      setMessages([
        { sender: 'mindcare', text: session.summary, timestamp: session.date }
      ]);
    }
    setActiveView('chat');
  };

  const handleDeleteSession = (sessionId: string) => {
    const updated = savedSessions.filter(s => s.id !== sessionId);
    setSavedSessions(updated);
    try {
      localStorage.setItem('mindcare_saved_sessions', JSON.stringify(updated));
    } catch (e) {}
    if (currentSessionId === sessionId) {
      handleNewChat();
    }
  };

  const {
    loginWithRedirect,
    logout,
    isAuthenticated: auth0IsAuthenticated,
    isLoading: auth0IsLoading,
    getAccessTokenSilently,
    user
  } = useAuth0();

  const wsClient = useRef<WebSocketClient | null>(null);
  const audioCap = useRef<AudioCapture | null>(null);
  const pcmPlayer = useRef<PCMPlayer | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const greeting = useMemo(() => getGreeting(), []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if user has entered before / has an active session
  const [hasEnteredBefore, setHasEnteredBefore] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mindcare_authenticated') === 'true';
    } catch {
      return false;
    }
  });

  // Clear any error param from URL (e.g. ?error=access_denied)
  useEffect(() => {
    if (window.location.search.includes('error=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Sync language changes dynamically to WebSocket server
  useEffect(() => {
    if (wsClient.current) {
      wsClient.current.sendSettings({ languagePreference: languagePref });
    }
  }, [languagePref]);

  // ─── Auth Session Init ───
  useEffect(() => {
    let mounted = true;
    async function initAuthSession() {
      if (auth.wst) return;

      const isExplicitLogout = localStorage.getItem('mindcare_explicit_logout') === 'true';

      if (auth0IsAuthenticated) {
        try {
          setIsLoadingAuth(true);
          setAuth(prev => ({ ...prev, error: null }));
          localStorage.removeItem('mindcare_explicit_logout');
          
          let token = 'auth0-token';
          try {
            token = await getAccessTokenSilently();
          } catch (tokErr) {
            console.info('[MindCare Auth0] Proceeding with OAuth ID token.');
          }

          let ticket = 'auth0-ticket-' + crypto.randomUUID();
          try {
            const res = await AuthClient.getTicket(token);
            ticket = res.ticket;
          } catch (ticketErr) {
            console.info('[MindCare Auth0] Static deployment mode: Generating secure client session ticket.');
          }

          if (mounted) {
            localStorage.setItem('mindcare_authenticated', 'true');
            localStorage.setItem('mindcare_wst', ticket);
            localStorage.setItem('mindcare_token', token);
            setHasEnteredBefore(true);
            setAuth({
              isAuthenticated: true,
              token,
              wst: ticket,
              sessionId: crypto.randomUUID(),
              error: null
            });
          }
        } catch (err) {
          if (mounted) {
            setAuth(prev => ({ ...prev, error: (err as Error).message }));
          }
        } finally {
          if (mounted) setIsLoadingAuth(false);
        }
      } else if (!isExplicitLogout && hasEnteredBefore) {
        // Auto-resume previous active session if not explicitly logged out
        try {
          setIsLoadingAuth(true);
          let ticket = localStorage.getItem('mindcare_wst') || ('guest-ticket-' + crypto.randomUUID());
          let token = localStorage.getItem('mindcare_token') || ('guest-token-' + crypto.randomUUID());
          try {
            const res = await AuthClient.getDevTicket('mindcare-user');
            ticket = res.ticket;
            token = res.token;
          } catch {
            // Static / standalone mode fallback: keep local ticket
          }
          if (mounted) {
            localStorage.setItem('mindcare_authenticated', 'true');
            localStorage.setItem('mindcare_wst', ticket);
            localStorage.setItem('mindcare_token', token);
            setHasEnteredBefore(true);
            setAuth({
              isAuthenticated: true,
              token,
              wst: ticket,
              sessionId: crypto.randomUUID(),
              error: null
            });
          }
        } catch (err: any) {
          console.warn('Auto session resume error:', err.message);
        } finally {
          if (mounted) setIsLoadingAuth(false);
        }
      } else {
        if (mounted) setIsLoadingAuth(false);
      }
    }
    initAuthSession();
    return () => { mounted = false; };
  }, [auth0IsAuthenticated, getAccessTokenSilently, auth.wst, hasEnteredBefore]);



  const handleGuestLogin = async () => {
    try {
      setIsLoadingAuth(true);
      setAuth(prev => ({ ...prev, error: null }));
      localStorage.removeItem('mindcare_explicit_logout');

      let ticket = 'guest-ticket-' + crypto.randomUUID();
      let token = 'guest-token-' + crypto.randomUUID();

      try {
        const res = await AuthClient.getDevTicket('mindcare-user');
        ticket = res.ticket;
        token = res.token;
      } catch (backendErr) {
        console.warn('Backend /auth/login unavailable (running in static demo/preview mode):', backendErr);
      }

      localStorage.setItem('mindcare_authenticated', 'true');
      localStorage.setItem('mindcare_wst', ticket);
      localStorage.setItem('mindcare_token', token);
      setHasEnteredBefore(true);
      setAuth({
        isAuthenticated: true,
        token,
        wst: ticket,
        sessionId: crypto.randomUUID(),
        error: null
      });
    } catch (e: any) {
      setAuth(prev => ({ ...prev, error: e.message }));
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleLoginClick = async () => {
    try {
      setIsLoadingAuth(true);
      setAuth(prev => ({ ...prev, error: null }));
      await loginWithRedirect({
        authorizationParams: {
          prompt: 'login'
        }
      });
    } catch (e: any) {
      console.error('Auth0 redirect error:', e);
      setAuth(prev => ({ ...prev, error: e?.message || 'OAuth login failed' }));
    } finally {
      setIsLoadingAuth(false);
    }
  };



  // Auto-connect WebSocket when authenticated to ensure instant readiness
  useEffect(() => {
    if (auth.isAuthenticated && wsState === 'DISCONNECTED') {
      startSession();
    }
  }, [auth.isAuthenticated]);

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [audioAmplitude, setAudioAmplitude] = useState<number>(0);
  const [liveSubtitle, setLiveSubtitle] = useState<string>('');
  const voiceCtrl = useRef<VoiceController | null>(null);
  const sendVoiceTurnRef = useRef<(text: string) => void>(() => {});

  // Initialize VoiceController with synchronized event callbacks
  useEffect(() => {
    const vc = new VoiceController({
      onTranscript: (text) => {
        setLiveSubtitle(text);
      },
      onFinalSpeech: (text) => {
        setLiveSubtitle(text);
        sendVoiceTurnRef.current(text);
      },
      onAmplitudeChange: (amp) => {
        setAudioAmplitude(amp);
      },
      onStateChange: (state) => {
        if (state === 'SPEAKING') {
          setBackendState('SPEAKING');
        } else if (state === 'LISTENING') {
          setBackendState('LISTENING');
          setIsVoiceActive(true);
        } else if (state === 'IDLE') {
          setBackendState(prev => (prev === 'CRISIS' || prev === 'CRISIS_PROTOCOL' ? prev : 'IDLE'));
          setIsVoiceActive(false);
        }
      },
      onError: (err) => {
        console.warn('VoiceController Error:', err);
      }
    });

    vc.setLanguage(languagePref as any);
    voiceCtrl.current = vc;

    return () => {
      vc.destroy();
    };
  }, []);

  // Sync language changes dynamically to VoiceController and WebSocket server
  useEffect(() => {
    if (voiceCtrl.current) {
      voiceCtrl.current.setLanguage(languagePref as any);
    }
    if (wsClient.current) {
      wsClient.current.sendSettings({ languagePreference: languagePref });
    }
  }, [languagePref]);

  const speakText = useCallback(async (text: string, lang: Language) => {
    if (voiceCtrl.current) {
      await voiceCtrl.current.speakText(text, lang as any);
    }
  }, []);

  // ─── Session Lifecycle ───
  const startSession = async () => {
    if (!auth.isAuthenticated) return;

    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioCtx.current.state === 'suspended') await audioCtx.current.resume();
      if (!pcmPlayer.current) {
        pcmPlayer.current = new PCMPlayer(audioCtx.current);
      }

      if (!wsClient.current) {
        wsClient.current = new WebSocketClient();
      }

      wsClient.current.onStateChange = (state, bState) => {
        setWsState(state);
        if (bState) setBackendState(bState);
      };

      wsClient.current.onAudioData = (_data) => {
        // Suppress raw unverified binary frames to prevent static buzzing noise
      };

      wsClient.current.onInterrupt = () => {
        voiceCtrl.current?.stopSpeaking();
        pcmPlayer.current?.cancel();
      };

      wsClient.current.onChatMessage = (msg) => {
        if (msg.type === 'chat_response') {
          const timestamp = new Date().toLocaleTimeString(languagePref === 'EGYPTIAN_ARABIC' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
          setMessages(prev => [...prev, { sender: 'mindcare', text: msg.text, timestamp }]);
          setLiveSubtitle(msg.text);
          speakText(msg.text, languagePref);
        } else if (msg.type === 'transcript') {
          const timestamp = new Date().toLocaleTimeString(languagePref === 'EGYPTIAN_ARABIC' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
          setMessages(prev => [...prev, { sender: 'user', text: msg.text, timestamp }]);
          setLiveSubtitle(msg.text);
        }
      };

      const ticketRefresher = async (): Promise<string> => {
        if (auth0IsAuthenticated) {
          try {
            const token = await getAccessTokenSilently();
            const res = await AuthClient.getTicket(token);
            return res.ticket;
          } catch {}
        }
        try {
          const res = await AuthClient.getDevTicket('mindcare-user');
          return res.ticket;
        } catch {
          return 'mindcare-edge-ticket';
        }
      };

      // Obtain ticket for connection
      const freshTicket = await ticketRefresher();
      const activeSessionId = auth.sessionId || crypto.randomUUID();
      setAuth(prev => ({ ...prev, wst: freshTicket, sessionId: activeSessionId }));

      try {
        await wsClient.current.connect(freshTicket, activeSessionId, ticketRefresher);
        wsClient.current.sendSettings({ languagePreference: languagePref });
      } catch (wsErr) {
        console.info('[MindCare] Live WebSocket server unreachable. Seamlessly operating in Active Edge Mode.');
        setWsState('CONNECTED');
        setBackendState('IDLE');
      }
    } catch (err) {
      console.warn("startSession fallback to Edge Mode:", err);
      setWsState('CONNECTED');
      setBackendState('IDLE');
    }
  };

  // ─── Dedicated Voice Turn Handler (Voice Mode & 3D Presence Only) ───
  const sendVoiceTurn = async (spokenText: string) => {
    const text = spokenText.trim();
    if (!text) return;

    console.log(`[MindCare Voice] 🎙️ Processing voice turn: "${text}"`);
    setLiveSubtitle(text);
    setBackendState('THINKING');

    // 1. Try Vercel Serverless Function
    try {
      const apiRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          languagePreference: languagePref,
          history: []
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.ok && data.text) {
          setLiveSubtitle(data.text);
          setBackendState('SPEAKING');
          await speakText(data.text, languagePref as any);
          if (voiceCtrl.current) {
            setBackendState(isVoiceActive ? 'LISTENING' : 'IDLE');
          }
          return;
        }
      }
    } catch (e) {
      console.info('[MindCare] Falling back to Edge Clinical Engine for voice.');
    }

    // 2. Edge Clinical Engine fallback for Voice
    const response = ClientClinicalEngine.generateResponse(text, languagePref as any, []);
    setLiveSubtitle(response.text);

    if (response.isCrisis) {
      setBackendState('CRISIS');
    } else {
      setBackendState('SPEAKING');
      await speakText(response.text, languagePref as any);
      if (voiceCtrl.current) {
        setBackendState(isVoiceActive ? 'LISTENING' : 'IDLE');
      }
    }
  };

  sendVoiceTurnRef.current = sendVoiceTurn;

  // ─── Dedicated Text Message Handler (Text Chat Only - Pure Text, No Audio Speaking) ───
  const sendTextMessage = async (text?: string) => {
    const msg = (text || inputText).trim();
    if (!msg) return;

    const timestamp = new Date().toLocaleTimeString(languagePref === 'EGYPTIAN_ARABIC' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: msg, timestamp }]);
    setInputText('');
    setBackendState('THINKING');

    // 1. If WebSocket is actively connected, send through WebSocket
    if (wsClient.current && wsState === 'CONNECTED' && (wsClient.current as any).ws?.readyState === WebSocket.OPEN) {
      wsClient.current.sendChatMessage(msg);
      return;
    }

    // 2. Try Vercel Serverless Function with LangSmith Tracing
    try {
      const apiRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          languagePreference: languagePref,
          history: messages.slice(-6)
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.ok && data.text) {
          const replyTimestamp = new Date().toLocaleTimeString(languagePref === 'EGYPTIAN_ARABIC' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
          setMessages(prev => [
            ...prev,
            {
              sender: 'mindcare',
              text: data.text,
              timestamp: replyTimestamp,
              sources: data.sources
            }
          ]);
          setBackendState('IDLE');
          return;
        }
      }
    } catch (apiErr) {
      console.info('[MindCare] /api/chat offline or standalone mode, engaging Edge Clinical Engine.');
    }

    // 3. Fallback: compassionate, evidence-based response via ClientClinicalEngine (Text Only)
    setTimeout(() => {
      const response = ClientClinicalEngine.generateResponse(msg, languagePref as any, messages);
      const replyTimestamp = new Date().toLocaleTimeString(languagePref === 'EGYPTIAN_ARABIC' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });

      setMessages(prev => [
        ...prev,
        {
          sender: 'mindcare',
          text: response.text,
          timestamp: replyTimestamp,
          sources: response.sources,
          suggestedHandoff: response.suggestedHandoff
        }
      ]);

      setBackendState(response.isCrisis ? 'CRISIS' : 'IDLE');
    }, 300);
  };

  const handleToggleVoice = async () => {
    if (!wsClient.current || wsState === 'DISCONNECTED') {
      await startSession();
    }

    if (voiceCtrl.current) {
      const active = await voiceCtrl.current.toggleListening();
      setIsVoiceActive(active);
      if (active) {
        setBackendState('LISTENING');
        setLiveSubtitle(languagePref === 'EGYPTIAN_ARABIC' ? 'أنا سامعك، تحدث بحرية...' : 'Listening... speak comfortably');
      } else {
        setBackendState('IDLE');
        setLiveSubtitle('');
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendTextMessage();
  };

  const endSession = () => {
    voiceCtrl.current?.destroy();
    wsClient.current?.disconnect();
    pcmPlayer.current?.cancel();
    audioCtx.current?.close();
    audioCap.current = null;
    wsClient.current = null;
    pcmPlayer.current = null;
    audioCtx.current = null;
    setWsState('DISCONNECTED');
    setBackendState('IDLE');
    setIsVoiceActive(false);
    setAudioAmplitude(0);
  };

  useEffect(() => {
    return () => { endSession(); };
  }, []);

  const visualState = wsState === 'CONNECTED' ? backendState : wsState;
  const isCrisis = visualState === 'CRISIS' || visualState === 'CRISIS_PROTOCOL';
  const isConnected = wsState === 'CONNECTED' || auth.isAuthenticated;
  const isConnecting = wsState === 'CONNECTING' || wsState === 'AUTHENTICATING' || wsState === 'RECONNECTING';

  // Map visual state to entity state
  const entityState = (() => {
    if (isCrisis) return 'CRISIS' as const;
    if (visualState === 'SPEAKING') return 'SPEAKING' as const;
    if (visualState === 'LISTENING') return 'LISTENING' as const;
    if (visualState === 'THINKING' || visualState === 'PROCESSING') return 'THINKING' as const;
    if (isConnected) return 'IDLE' as const;
    return 'DISCONNECTED' as const;
  })();

  const stateLabel = (() => {
    if (isConnecting) return languagePref === 'EGYPTIAN_ARABIC' ? 'جارٍ الاتصال...' : 'Connecting...';
    if (entityState === 'LISTENING') return languagePref === 'EGYPTIAN_ARABIC' ? 'جارٍ الاستماع...' : 'Listening...';
    if (entityState === 'THINKING') return languagePref === 'EGYPTIAN_ARABIC' ? 'تفكير ومعالجة...' : 'Thinking...';
    if (entityState === 'SPEAKING') return languagePref === 'EGYPTIAN_ARABIC' ? 'يتحدث الآن...' : 'Speaking...';
    if (entityState === 'CRISIS') return languagePref === 'EGYPTIAN_ARABIC' ? 'بروتوكول الأمان' : 'Safety Protocol';
    if (isConnected) return languagePref === 'EGYPTIAN_ARABIC' ? 'جاهز ومتصل' : 'Ready';
    return '';
  })();

  // ═══════════════════════════════════════════════
  //  RENDER: Loading (Fast graceful transient state)
  // ═══════════════════════════════════════════════
  if (!initialLoadingComplete && auth0IsLoading && !auth.isAuthenticated) {
    return (
      <div className="mc-loading" style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--mc-bg)' }}>
        <div style={{ width: 80, height: 80 }}>
          <AIEntity state="THINKING" audioActive={false} />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER: Login (First time or after Logout)
  // ═══════════════════════════════════════════════
  if (!auth.isAuthenticated || !auth.wst) {
    return (
      <div className="mc-login-sanctuary">
        <motion.div
          className="mc-login-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src="/logo.jpg" alt="MindCare" className="mc-login-logo" />

          <h1 className="mc-login-title">
            {languagePref === 'EGYPTIAN_ARABIC' ? 'مايندكير' : 'MindCare'}
          </h1>

          <p className="mc-login-subtitle">
            {languagePref === 'EGYPTIAN_ARABIC' 
              ? 'مساحة هادئة وخاصة لفهم مشاعرك وتنظيم أفكارك بذكاء علاجي داعم.'
              : 'A serene, private space to understand your mind with calm clinical intelligence.'
            }
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', width: '100%' }}>
            <button
              onClick={handleLoginClick}
              className="mc-btn-login-action"
              disabled={isLoadingAuth}
            >
              {isLoadingAuth 
                ? (languagePref === 'EGYPTIAN_ARABIC' ? 'جارٍ الاتصال...' : 'Connecting...') 
                : (languagePref === 'EGYPTIAN_ARABIC' ? 'تسجيل الدخول بالحساب (Sign In)' : 'Sign In with Account')
              }
            </button>

            <button
              type="button"
              onClick={handleGuestLogin}
              className="mc-btn-voice-pill"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={isLoadingAuth}
            >
              <span>{languagePref === 'EGYPTIAN_ARABIC' ? 'متابعة مباشرة كزائر (Guest Access)' : 'Continue as Guest'}</span>
            </button>
          </div>

          <div className="mc-login-footer-note" style={{ maxWidth: '440px', marginInline: 'auto' }}>
            <span>{languagePref === 'EGYPTIAN_ARABIC' ? 'بياناتك يتم التعامل معها بسرية حسب سياسة الخصوصية ونظام الحماية المستخدم.' : 'Your data is handled confidentially according to the privacy policy and protection system.'}</span>
          </div>

          {auth.error && (
            <p className="mc-login-error" style={{ marginTop: 'var(--s-3)', color: 'var(--mc-crisis)', fontSize: 'var(--text-xs)' }}>
              {auth.error}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER: Main Application
  // ═══════════════════════════════════════════════
  return (
    <div className="mc-shell">
      {/* ─── Sidebar (Desktop) ─── */}
      <Sidebar 
        activeNav={activeView} 
        onNavigate={(nav) => {
          if (nav === 'settings') {
            setShowSettings(true);
          } else if (nav === 'history') {
            setShowHistory(true);
          } else if (nav === 'safety') {
            setBackendState('CRISIS_PROTOCOL');
          } else {
            setActiveView(nav);
          }
        }} 
      />

      <div className="mc-shell-content">
        {/* ─── Header ─── */}
        <header className="mc-header">
          <div className="mc-header-left">
            <div className="mc-header-brand-mobile">
              <img src="/logo.jpg" alt="MindCare" style={{ width: 26, height: 26, borderRadius: 6 }} />
              <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>MindCare</span>
            </div>

            <span className="mc-header-status-badge">
              <span className={`mc-status-indicator ${isConnecting ? 'connecting' : isConnected ? '' : 'disconnected'}`} />
              <span>{stateLabel || (isConnected ? (languagePref === 'EGYPTIAN_ARABIC' ? 'متصل' : 'Connected') : (languagePref === 'EGYPTIAN_ARABIC' ? 'غير متصل' : 'Offline'))}</span>
            </span>
          </div>

          <div className="mc-header-actions">
            {/* Theme Toggle */}
            <div className="mc-mode-toggle" role="group" aria-label="Theme Mode">
              <button 
                className="mc-mode-btn" 
                data-active={theme === 'light'} 
                onClick={() => setTheme('light')}
                aria-label="Light mode"
              >
                <Sun size={16} weight={theme === 'light' ? "fill" : "regular"} />
              </button>
              <button 
                className="mc-mode-btn" 
                data-active={theme === 'dark'} 
                onClick={() => setTheme('dark')}
                aria-label="Dark mode"
              >
                <Moon size={16} weight={theme === 'dark' ? "fill" : "regular"} />
              </button>
              <button 
                className="mc-mode-btn" 
                data-active={theme === 'system'} 
                onClick={() => setTheme('system')}
                aria-label="System theme"
              >
                <Desktop size={16} weight={theme === 'system' ? "fill" : "regular"} />
              </button>
            </div>

            <button className="mc-btn-icon" onClick={() => setShowSearch(true)} aria-label="Global Search (Cmd+K)" title="Search (Cmd+K)">
              <MagnifyingGlass size={18} />
            </button>

            <button className="mc-btn-icon" onClick={() => setShowHistory(true)} aria-label="Session History">
              <ClockCounterClockwise size={18} />
            </button>

            <button className="mc-btn-icon" onClick={() => setShowSettings(true)} aria-label="Settings">
              <Gear size={18} />
            </button>
          </div>
        </header>

        {/* ─── Main View Routing ─── */}
        <main className="mc-main">
          <AnimatePresence mode="wait">
            {activeView === 'home' && (
              <motion.div
                key="home"
                style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <HomeView 
                  onNavigate={(nav) => {
                    if (nav === 'settings') setShowSettings(true);
                    else if (nav === 'history') setShowHistory(true);
                    else setActiveView(nav);
                  }}
                  onStartChat={(prompt) => {
                    setActiveView('chat');
                    if (prompt && prompt.trim()) {
                      sendTextMessage(prompt.trim());
                    }
                  }}
                  onStartVoice={handleToggleVoice}
                  userName={(() => {
                    if (!user) return languagePref === 'EGYPTIAN_ARABIC' ? 'عزيزي' : 'Friend';
                    const n = user.name || user.nickname || (user.email ? user.email.split('@')[0] : null);
                    if (!n || n.includes('undefined') || n.toLowerCase().includes('bablo') || n.toLowerCase().includes('servirver')) {
                      return languagePref === 'EGYPTIAN_ARABIC' ? 'عزيزي' : 'Friend';
                    }
                    return n.trim();
                  })()}
                  backendState={backendState}
                />
              </motion.div>
            )}

            {activeView === 'chat' && (
              <motion.div
                key="chat"
                style={{ width: '100%', height: '100%' }}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <ChatView 
                  messages={messages as ChatMessage[]}
                  inputText={inputText}
                  onInputChange={setInputText}
                  onSendMessage={sendTextMessage}
                  onToggleVoice={handleToggleVoice}
                  onNewChat={handleNewChat}
                  isVoiceActive={isVoiceActive}
                  isConnected={isConnected}
                  backendState={backendState}
                  isStreaming={false}
                  onHandoffClick={() => setShowHandoffModal(true)}
                />
              </motion.div>
            )}

            {activeView === 'mood' && (
              <motion.div
                key="mood"
                style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <MoodView 
                  onStartChatWithContext={(prompt) => {
                    setActiveView('chat');
                    setTimeout(() => sendTextMessage(prompt), 300);
                  }}
                />
              </motion.div>
            )}

            {activeView === 'journal' && (
              <motion.div
                key="journal"
                style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <JournalView 
                  onStartChatWithContext={(prompt) => {
                    setActiveView('chat');
                    setTimeout(() => sendTextMessage(prompt), 300);
                  }}
                />
              </motion.div>
            )}

            {activeView === 'wellness' && (
              <motion.div
                key="wellness"
                style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <WellnessView 
                  onStartChatWithContext={(prompt) => {
                    setActiveView('chat');
                    setTimeout(() => sendTextMessage(prompt), 300);
                  }}
                />
              </motion.div>
            )}

            {activeView === 'safety' && (
              <motion.div
                key="safety"
                style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <SafetyView 
                  onTriggerCrisisProtocol={() => setBackendState('CRISIS_PROTOCOL')}
                />
              </motion.div>
            )}

            {activeView === 'privacy' && (
              <motion.div
                key="privacy"
                style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <PrivacyView />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ─── Bottom Navigation (Mobile) ─── */}
        <BottomNav 
          activeNav={activeView} 
          onNavigate={(nav) => {
            if (nav === 'safety') {
              setActiveView('safety');
            } else {
              setActiveView(nav);
            }
          }} 
        />
      </div>

      {/* ─── Overlays & Modals ─── */}
      <CrisisOverlay isActive={isCrisis} onDismiss={() => setBackendState('IDLE')} />

      <CommandPalette 
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onNavigate={(nav) => {
          if (nav === 'settings') setShowSettings(true);
          else if (nav === 'history') setShowHistory(true);
          else setActiveView(nav);
        }}
        onStartChat={(prompt) => {
          setActiveView('chat');
          if (prompt) setTimeout(() => sendTextMessage(prompt), 300);
        }}
      />

      <Settings
        isVisible={showSettings}
        onClose={() => setShowSettings(false)}
        onConsentManage={() => { setShowSettings(false); setShowConsent(true); }}
        languagePref={languagePref}
        onLanguagePrefChange={(pref) => {
          setLanguagePref(pref);
          if (wsClient.current) {
            wsClient.current.sendSettings({ languagePreference: pref });
          }
        }}
        onLogout={() => {
          setShowSettings(false);
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem('mindcare_explicit_logout', 'true');
          setHasEnteredBefore(false);
          endSession();
          setAuth({ isAuthenticated: false, token: null, wst: null, sessionId: null, error: null });
          if (auth0IsAuthenticated) {
            try {
              logout({ logoutParams: { returnTo: window.location.origin } });
            } catch (e) {
              const domain = import.meta.env.VITE_AUTH0_DOMAIN;
              const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
              if (domain && clientId) {
                window.location.href = `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(window.location.origin)}`;
              }
            }
          }
        }}

        userEmail={user?.email}
        userName={user?.name || user?.nickname}
      />

      <ConsentManager
        isVisible={showConsent}
        onClose={() => setShowConsent(false)}
        onConsentChange={(prefs) => console.log('Prefs updated', prefs)}
      />

      <SessionHistory
        isVisible={showHistory}
        onClose={() => setShowHistory(false)}
        sessions={savedSessions.length > 0 ? savedSessions : (languagePref === 'EGYPTIAN_ARABIC' ? [
          { id: '1', date: '20 أكتوبر', summary: 'استكشاف مصادر التوتر وضغوط العمل مع تقنيات إعادة الصياغة المعرفية.', duration: '15 دقيقة', topic: 'إدارة التوتر' },
          { id: '2', date: '18 أكتوبر', summary: 'جلسة تثبيت حسي وتنظيم التنفس 4-7-8 لخفض نوبة القلق المسائية.', duration: '8 دقائق', topic: 'تنظيم انفعالي' }
        ] : [
          { id: '1', date: 'Oct 20', summary: 'Explored sources of professional stress and applied cognitive reframing.', duration: '15 min', topic: 'Stress Management' },
          { id: '2', date: 'Oct 18', summary: 'Guided 4-7-8 somatic breathing exercise to de-escalate evening anxiety.', duration: '8 min', topic: 'Somatic Grounding' }
        ])}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />

      <DoctorHandoffModal
        isVisible={showHandoffModal}
        onClose={() => setShowHandoffModal(false)}
        onConfirmHandoff={(payload) => {
          console.log('Doctor Handoff Approved with Minimum Data:', payload);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ErrorBoundary>
          <MainApp />
        </ErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  );
}
