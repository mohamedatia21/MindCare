import 'dotenv/config';
import { Redis } from 'ioredis';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const InboundMessageSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('auth'),
        token: z.string().min(1)
    }),
    z.object({
        type: z.literal('chat'),
        text: z.string().min(1).max(5000)
    }),
    z.object({
        type: z.literal('settings'),
        languagePreference: z.enum(['ENGLISH', 'EGYPTIAN_ARABIC']).optional()
    }),
    z.object({
        type: z.literal('test_voice')
    })
]);

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { StreamingMindCareRuntime } from '../core/streaming-orchestrator.js';
import { DeepgramStreamingSTT } from '../infrastructure/voice/deepgram-stt.js';
import { ElevenLabsStreamingTTS } from '../infrastructure/voice/elevenlabs-tts.js';
import { MockStreamingSTTProvider, MockStreamingTTSProvider } from '../infrastructure/voice/mock-providers.js';
import { VoiceStateMachine } from '../core/voice/voice-state-machine.js';
import { RuntimeLogger } from '../observability/runtime-logger.js';
import { Actor, ActorRole, ContextPackage } from '../memory/types.js';
import { UnifiedInput } from '../core/input/unified-input.js';

import { StreamingSTTProvider } from '../infrastructure/voice/stt-interface.js';
import { StreamingTTSProvider } from '../infrastructure/voice/tts-interface.js';
import { dbPool } from '../infrastructure/database/pg-pool.js';
import { PostgresMemoryRepository } from '../infrastructure/database/pg-memory-repository.js';
import { PostgresSessionRepository } from '../infrastructure/database/pg-session-repository.js';
import { InMemoryMemoryRepository } from '../memory/repository.js';
import { JWTService, AuthenticatedUserContext } from '../infrastructure/auth/jwt-service.js';
import { WSTicketService } from '../infrastructure/auth/ws-ticket-service.js';
import { MemoryAuditLogger } from '../memory/audit-logger.js';
import { MetricsCollector } from '../observability/metrics-collector.js';

// MindCareRuntime Dependencies
import { MindCareRuntime } from '../core/orchestrator.js';
import { ProductionSafetyPipeline } from '../safety/safety-pipeline.js';
import { DeterministicDetector } from '../safety/deterministic-detector.js';
import { FastLLMSafetyClassifier } from '../safety/fast-llm-classifier.js';
import { MockSafetyClassifier } from '../safety/classifier-interface.js';
import { ContextAwareAssessor } from '../safety/context-assessment.js';
import { ConservativeFallback } from '../safety/fallback-handler.js';
import { StateMachine } from '../core/state-machine.js';
import { DefaultClinicalRouter } from '../routing/clinical-router.js';
import { SkillRegistry } from '../clinical/skills/skill-registry.js';
import { SkillPolicyGate } from '../clinical/skills/skill-policy.js';
import { SupportiveConversationSkill } from '../clinical/skills/supportive-conversation/skill.js';
import { CBTSkill } from '../clinical/skills/cbt/skill.js';
import { GroundingSkill } from '../clinical/skills/grounding/skill.js';
import { JournalingSkill } from '../clinical/skills/journaling/skill.js';
import { ProgressReflectionSkill } from '../clinical/skills/progress-reflection/skill.js';
import { BreathingSkill } from '../clinical/skills/breathing/skill.js';
import { SleepSupportSkill } from '../clinical/skills/sleep-support/skill.js';
import { BehavioralActivationSkill } from '../clinical/skills/behavioral-activation/skill.js';
import { PsychoeducationSkill } from '../clinical/skills/psychoeducation/skill.js';
import { LLMRuntime } from '../clinical/llm-runtime.js';
import { OutputSafetyFilter } from '../clinical/output-safety-filter.js';
import { OpenAIStreamingLLM } from '../infrastructure/llm/openai-llm.js';
import { FallbackStreamingLLM } from '../infrastructure/llm/fallback-provider.js';
import { AdvancedToolGate } from '../tools/tool-gate.js';
import { MemoryPolicyGate } from '../memory/memory-policy.js';
import { MemoryMinimizer } from '../tools/minimizer.js';
import { CrisisResponseBuilder } from '../clinical/crisis-response-builder.js';
import { DefaultResourceResolver } from '../safety/resource-resolver.js';
import { LLMProvider, LLMRequest, StructuredLLMOutput } from '../clinical/types.js';
import { RAGTool } from '../infrastructure/rag/rag-tool.js';
import { KnowledgeRetriever } from '../infrastructure/rag/knowledge-retriever.js';
import { PineconeKnowledgeStore, KnowledgeMetadata } from '../infrastructure/vector/pinecone-knowledge-store.js';
import { PineconeMemoryStore, MemoryMetadata } from '../infrastructure/vector/pinecone-memory-store.js';
import { QdrantKnowledgeStore } from '../infrastructure/vector/qdrant-knowledge-store.js';
import { QdrantMemoryStore } from '../infrastructure/vector/qdrant-memory-store.js';
import { VectorStore } from '../infrastructure/vector/vector-store.js';

import { MigrationRunner } from '../infrastructure/database/migration-runner.js';

// Setup ES Modules path resolving
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-Memory Rate Limiter for Auth and Connection Handshakes
interface RateLimitBucket {
    tokens: number;
    lastRefill: number;
}

export class RealtimeVoiceServer {
    private app = express();
    private server = createServer(this.app);
    private wss = new WebSocketServer({ server: this.server });
    private logger = new RuntimeLogger();

    private jwtService = new JWTService();
    private redis: Redis | undefined;
    private wstService: WSTicketService = new WSTicketService();
    private rateLimitStore = new Map<string, RateLimitBucket>();

    constructor(
        private readonly orchestratorFactory: (stt: StreamingSTTProvider, tts: StreamingTTSProvider) => StreamingMindCareRuntime,
        private readonly llmProvider?: { healthCheck?: () => Promise<boolean> }
    ) {
        if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_AUTH !== 'true') {
            console.error('FATAL: Insecure authentication is disabled. Set ALLOW_INSECURE_AUTH=true to run in demo mode.');
            process.exit(1);
        }

        if (process.env.REDIS_URL || process.env.VALKEY_URL) {
            this.redis = new Redis(process.env.VALKEY_URL || process.env.REDIS_URL || 'redis://localhost:6379', {
                maxRetriesPerRequest: 0,
                enableOfflineQueue: false,
                lazyConnect: true,
                retryStrategy: () => null // Do not retry automatically
            });
            this.redis.on('error', (err: any) => {
               if (err.code === 'ECONNREFUSED') {
                   // Suppress aggressive local redis spam
               } else {
                   console.error('[ioredis] error:', err.message);
               }
            });
            this.wstService = new WSTicketService(this.redis);
        }

        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSockets();
        this.setupGracefulShutdown();
    }

    private setupMiddleware() {
        // 1. Security Headers (Strict CSP, HSTS, Sniff Prevention, Frame Guard)
        this.app.use((req, res, next) => {
            res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:;");
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
            next();
        });

        // 2. CORS Handling
        this.app.use((req, res, next) => {
            const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
            const requestOrigin = req.headers.origin;
            
            // If it's a preflight or cross-origin request
            if (requestOrigin) {
                if (requestOrigin === allowedOrigin) {
                    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                    res.setHeader('Access-Control-Allow-Credentials', 'true');
                } else {
                    // For any Origin not in the explicit whitelist, the server must respond with NO Access-Control-Allow-Origin header
                    res.removeHeader('Access-Control-Allow-Origin');
                    res.removeHeader('Access-Control-Allow-Credentials');
                    if (req.method === 'OPTIONS') {
                        return res.status(403).end('CORS origin denied');
                    }
                    // For non-OPTIONS requests, the lack of headers will cause the browser to fail the CORS check.
                }
            }
            
            if (req.method === 'OPTIONS') {
                return res.sendStatus(204);
            }
            next();
        });

        // 3. Rate Limiting Middleware for Auth Endpoints
        this.app.use('/auth', (req, res, next) => {
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            const now = Date.now();
            const bucket = this.rateLimitStore.get(ip) || { tokens: 30, lastRefill: now };
            
            // Refill: 1 token every 2 seconds, max 30
            const refill = Math.floor((now - bucket.lastRefill) / 2000);
            if (refill > 0) {
                bucket.tokens = Math.min(30, bucket.tokens + refill);
                bucket.lastRefill = now;
            }

            if (bucket.tokens <= 0) {
                this.logger.warn('RateLimitExceeded', { requestId: 'auth', ip, timestamp: new Date() });
                return res.status(429).json({ error: 'Too many requests, please slow down.' });
            }

            bucket.tokens--;
            this.rateLimitStore.set(ip, bucket);
            next();
        });

        // 4. Static frontend & JSON body parser
        this.app.use(express.static(join(__dirname, '../client/dist')));
        this.app.use(express.static(join(__dirname, '../client')));
        this.app.use(express.json());
    }

    private setupRoutes() {
        // Deep Healthcheck (Checks DB Pool, Redis/Valkey, and LLM Provider)
        this.app.get('/health', async (req, res) => {
            const healthStatus = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    database: 'disabled',
                    valkey: 'disabled',
                    llm: 'ready'
                }
            };

            let isHealthy = true;

            // 1. Check Postgres DB if configured
            if (dbPool) {
                try {
                    await dbPool.query('SELECT 1');
                    healthStatus.services.database = 'connected';
                } catch (err: any) {
                    healthStatus.services.database = 'unreachable';
                    isHealthy = false;
                }
            }

            // 2. Check Valkey / Redis if configured
            if (this.redis) {
                try {
                    await this.redis.ping();
                    healthStatus.services.valkey = 'connected';
                } catch (err: any) {
                    healthStatus.services.valkey = 'unreachable';
                    isHealthy = false;
                }
            }

            // 3. Check LLM provider
            if (this.llmProvider?.healthCheck) {
                try {
                    const llmOk = await this.llmProvider.healthCheck();
                    healthStatus.services.llm = llmOk ? 'ready' : 'degraded';
                    if (!llmOk && process.env.NODE_ENV === 'production') isHealthy = false;
                } catch {
                    healthStatus.services.llm = 'error';
                    if (process.env.NODE_ENV === 'production') isHealthy = false;
                }
            }

            const statusCode = isHealthy ? 200 : 503;
            res.status(statusCode).json({ ...healthStatus, status: isHealthy ? 'healthy' : 'degraded' });
        });

        // WST Generation Endpoint
        this.app.post('/auth/ticket', async (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Missing or invalid authorization header' });
            }
            try {
                const parts = authHeader.split(' ');
                const token = parts.length > 1 ? parts[1] : undefined;
                if (!token) throw new Error('Malformed authorization header');
                const payload = await this.jwtService.verify(token);
                const ticket = await this.wstService.generateTicket(payload);
                res.json({ ticket });
            } catch (err: any) {
                res.status(401).json({ error: err.message });
            }
        });

        // Login endpoint – issues a JWT for a given userId (DEVELOPMENT ONLY)
        this.app.post('/auth/login', (req, res) => {
            if (process.env.NODE_ENV === 'production') {
                this.logger.error('ProductionAuthAttempt', { requestId: 'auth', timestamp: new Date(), message: '/auth/login is disabled in production. Use external IdP.' });
                return res.status(403).json({ error: 'Forbidden: Development authentication is disabled in production.' });
            }

            // Development fallback
            this.logger.warn('INSECURE AUTH MODE – DO NOT USE IN PRODUCTION.', { requestId: 'auth', timestamp: new Date() });
            
            const { userId, role } = req.body || {};
            if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
                return res.status(400).json({ error: 'userId is required' });
            }
            const sanitizedRole = (typeof role === 'string' && ['patient', 'clinician', 'admin'].includes(role)) ? role : 'patient';
            const token = this.jwtService.sign({ sub: userId.trim(), role: sanitizedRole });
            res.json({ token, userId: userId.trim(), role: sanitizedRole });
        });

        // Dev token generator (MUST BE DISABLED IN PROD)
        this.app.get('/auth/dev-token', (req, res) => {
            if (process.env.NODE_ENV === 'production') {
                return res.status(404).json({ error: 'Not Found' });
            }
            const userId = (req.query.userId as string) || randomUUID();
            const role = (req.query.role as string) || 'USER';
            const token = this.jwtService.sign({ sub: userId, role });
            res.json({ token, userId, role });
        });
    }

    private setupGracefulShutdown() {
        const shutdown = async (signal: string) => {
            this.logger.info('GracefulShutdownInitiated', { requestId: 'system', signal, timestamp: new Date() });
            
            // 1. Close WebSocket connections cleanly (code 1001: Going Away)
            for (const client of this.wss.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.close(1001, 'Server shutting down');
                }
            }

            // 2. Stop accepting new HTTP requests
            this.server.close(async () => {
                // 3. Disconnect Redis / Valkey
                if (this.redis) {
                    try {
                        await this.redis.quit();
                    } catch {}
                }

                // 4. Drain DB Pool
                if (dbPool) {
                    try {
                        await dbPool.end();
                    } catch {}
                }

                this.logger.info('GracefulShutdownCompleted', { requestId: 'system', timestamp: new Date() });
                process.exit(0);
            });

            // Force exit if hanging after 10s
            setTimeout(() => {
                this.logger.error('GracefulShutdownTimeout', { requestId: 'system', timestamp: new Date() });
                process.exit(1);
            }, 10000).unref();
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    private setupWebSockets() {
        this.wss.on('connection', (ws: WebSocket) => {
            const sessionId = randomUUID();
            this.logger.info('RealtimeConnectionEstablished', { requestId: sessionId, sessionId, timestamp: new Date() });

            // We must manage the audio stream bridging
            const sttProvider = process.env.DEEPGRAM_API_KEY ? new DeepgramStreamingSTT() : new MockStreamingSTTProvider();
            const ttsProvider = process.env.ELEVENLABS_API_KEY ? new ElevenLabsStreamingTTS() : new MockStreamingTTSProvider();
            
            const orchestrator = this.orchestratorFactory(sttProvider, ttsProvider);

            let authContext: AuthenticatedUserContext | null = null;
            let authenticated = false;
            let currentSessionId: string | null = null;

            // Auth timeout: force close if not authenticated within 3s
            const authTimeout = setTimeout(() => {
                if (!authenticated) {
                    this.logger.warn('WebSocketAuthTimeout', { requestId: sessionId, timestamp: new Date() });
                    ws.close(4001, 'Authentication timeout');
                }
            }, 3000);

            // Create an async iterable stream that we can push WebSocket binary frames into
            const audioQueue: (Buffer | string)[] = [];
            let resolveNext: (() => void) | null = null;
            let streamClosed = false;

            const audioStream: AsyncIterable<Buffer | string> = {
                [Symbol.asyncIterator]() {
                    return {
                        async next() {
                            if (audioQueue.length === 0 && !streamClosed) {
                                await new Promise<void>(r => { resolveNext = r; });
                            }
                            if (audioQueue.length > 0) {
                                return { value: audioQueue.shift()!, done: false };
                            }
                            return { value: undefined as any, done: true };
                        }
                    };
                }
            };

            const onAudio = (chunk: Buffer) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(chunk);
                }
            };

            const onControl = (ctrl: any) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(ctrl));
                }
            };

            ws.on('message', async (data, isBinary) => {
                if (!authenticated) {
                    if (isBinary) return; // Drop audio until authenticated
                    try {
                        const msg = JSON.parse(data.toString());
                        if (msg.type === 'auth' && msg.ticket) {
                            const payload = await this.wstService.consumeTicket(msg.ticket);
                            if (!payload) {
                                ws.close(4001, 'Invalid or expired ticket');
                                return;
                            }
                            
                            clearTimeout(authTimeout);
                            authenticated = true;
                            currentSessionId = msg.sessionId || randomUUID();

                            authContext = {
                                userId: payload.sub,
                                sessionId: currentSessionId!,
                                role: payload.role as ActorRole,
                                authenticatedAt: new Date()
                            };

                            this.logger.info('WebSocketAuthenticated', { 
                                requestId: sessionId,
                                userId: authContext.userId, 
                                sessionId: currentSessionId!,
                                timestamp: new Date()
                            });

                            // Optionally, create session in DB if it doesn't exist
                            if (dbPool) {
                                try {
                                    const sessionRepo = new PostgresSessionRepository(dbPool);
                                    const existing = await sessionRepo.getSession(authContext.userId, currentSessionId!);
                                    if (!existing) {
                                        await sessionRepo.createSession(authContext.userId, currentSessionId!);
                                    }
                                } catch (dbErr) {
                                    this.logger.warn('SessionPersistenceNonFatal', { requestId: sessionId, reasonCode: (dbErr as Error).message, timestamp: new Date() });
                                }
                            }

                            ws.send(JSON.stringify({ type: 'auth_success' }));
                            ws.send(JSON.stringify({ type: 'state', state: 'LISTENING' }));
                            
                            // Start processing the stream now that we are authenticated
                            const actorRole: ActorRole = authContext.role === 'CLINICAL_AGENT' ? 'CLINICAL_AGENT' : 'USER';
                            const actor: Actor = { id: authContext.userId, role: actorRole };
                            const contextPackage: ContextPackage = { CURRENT_SESSION: [], USER_PREFERENCES: [], APPROVED_PROGRESS: [], RELEVANT_CONTEXT: [], SAFETY_CONTEXT: [] };

                            // Run continuous turns only when audio frames are available
                            (async () => {
                                while (ws.readyState === WebSocket.OPEN && !streamClosed) {
                                    try {
                                        if (audioQueue.length === 0 && !streamClosed) {
                                            await new Promise<void>(r => { resolveNext = r; });
                                        }
                                        if (audioQueue.length > 0 && !streamClosed) {
                                            const metadata: any = {};
                                            if (authContext?.languagePreference) metadata.languagePreference = authContext.languagePreference;
                                            await orchestrator.processAudioStream(audioStream, actor, contextPackage, onAudio, onControl, metadata);
                                        }
                                    } catch (err: any) {
                                        this.logger.error('OrchestratorStreamFailed', { requestId: sessionId, reasonCode: err.message || 'Unknown Error', timestamp: new Date() });
                                        await new Promise(r => setTimeout(r, 1000));
                                    }
                                }
                            })();
                        }
                    } catch (e) {}
                    return;
                }

                if (isBinary) {
                    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
                    if (audioQueue.length >= 2000) {
                        this.logger.warn('AudioQueueOverflow', { requestId: sessionId, timestamp: new Date() });
                        audioQueue.shift(); // Drop oldest frame (Bounded Resource Strategy)
                    }
                    audioQueue.push(buf);
                    if (resolveNext) {
                        resolveNext();
                        resolveNext = null;
                    }
                } else if (!isBinary) {
                    const msg = data.toString();
                    try {
                        const parsedRaw = JSON.parse(msg);
                        const validation = InboundMessageSchema.safeParse(parsedRaw);
                        if (!validation.success) {
                            this.logger.warn('InvalidInboundMessage', { requestId: sessionId, error: validation.error.message, timestamp: new Date() });
                            return;
                        }
                        const parsed = validation.data;
                        
                        if (parsed.type === 'chat') {
                            this.logger.info('ChatMessageReceived', { requestId: sessionId, text: parsed.text, timestamp: new Date() });
                            const actorRole: ActorRole = authContext?.role === 'CLINICAL_AGENT' ? 'CLINICAL_AGENT' : 'USER';
                            const actor: Actor = { id: authContext?.userId || 'anonymous', role: actorRole };
                            const contextPackage: ContextPackage = { CURRENT_SESSION: [], USER_PREFERENCES: [], APPROVED_PROGRESS: [], RELEVANT_CONTEXT: [], SAFETY_CONTEXT: [] };
                            
                            (async () => {
                                try {
                                    const metadata: any = {};
                                    if (authContext?.languagePreference) metadata.languagePreference = authContext.languagePreference;
                                    await orchestrator.processTextMessage(parsed.text.trim(), actor, contextPackage, onAudio, onControl, metadata);
                                } catch (chatErr: any) {
                                    this.logger.error('ChatMessageProcessingFailed', { requestId: sessionId, reasonCode: chatErr.message, timestamp: new Date() });
                                }
                            })();
                            return;
                        }
                        if (parsed.type === 'settings' && parsed.languagePreference) {
                            if (authContext) {
                                authContext.languagePreference = parsed.languagePreference;
                                this.logger.info('LanguagePreferenceUpdated', { requestId: sessionId, language: parsed.languagePreference, timestamp: new Date() });
                            }
                            if (sttProvider && typeof (sttProvider as any).setLanguage === 'function') {
                                (sttProvider as any).setLanguage(parsed.languagePreference);
                            }
                            return;
                        }
                        if (parsed.type === 'test_voice') {
                            this.logger.info('TestVoiceRequested', { requestId: sessionId, timestamp: new Date() });
                            // Isolate TTS stream
                            (async () => {
                                ws.send(JSON.stringify({ type: 'state', state: 'THINKING' }));
                                ws.send(JSON.stringify({ type: 'audio_start', turnId: 'test-turn' }));
                                
                                async function* testText() {
                                    yield "مرحباً، هذا اختبار للصوت. ";
                                }
                                for await (const chunk of ttsProvider.synthesizeStream(testText(), 'test-turn')) {
                                    if (chunk.audioChunk) {
                                        ws.send(chunk.audioChunk);
                                    }
                                }
                                ws.send(JSON.stringify({ type: 'audio_end', turnId: 'test-turn' }));
                                ws.send(JSON.stringify({ type: 'state', state: 'LISTENING' }));
                            })();
                            return;
                        }
                    } catch (e) {
                        // ignore JSON parse errors for raw strings
                    }
                    if (msg === 'MOCK_CRISIS' || msg === 'MOCK_FINAL') {
                        audioQueue.push(msg); // Let the mock STT pick it up
                        if (resolveNext) {
                            resolveNext();
                            resolveNext = null;
                        }
                    }
                }
            });

            // Ensure cleanup happens on disconnect
            ws.on('close', () => {
                this.logger.info('RealtimeConnectionClosed', { requestId: sessionId, sessionId, timestamp: new Date() });
                streamClosed = true;
                audioQueue.length = 0; // Immediate cleanup of resources

                if (resolveNext) resolveNext();
                // We should cancel any ongoing orchestrator turn here
                ttsProvider.cancel('all');
            });
        });
    }

    public async start(port: number) {
        if (dbPool) {
            try {
                const runner = new MigrationRunner(dbPool);
                await runner.runMigrations();
                this.logger.info('DatabaseMigrationsAutoRunSuccess', { requestId: 'server', timestamp: new Date() });
            } catch (err: any) {
                this.logger.error('DatabaseMigrationsAutoRunFailed', { requestId: 'server', reasonCode: err.message, timestamp: new Date() });
            }
        }

        this.server.listen(port, () => {
            console.log(`Realtime Voice Server listening on port ${port}`);
        });
    }
}

// Start the server if this file is executed directly
if (process.argv[1] && (process.argv[1].endsWith('realtime-server.ts') || process.argv[1].endsWith('realtime-server.js'))) {
    const logger = new RuntimeLogger();
    
    // Wire up the full real MindCareRuntime
    const pipeline = new ProductionSafetyPipeline(
        new DeterministicDetector(),
        new FastLLMSafetyClassifier(),
        new ContextAwareAssessor(),
        new ConservativeFallback()
    );
    const stateMachine = new StateMachine();
    
    // Register Real Clinical Skills
    const skillRegistry = new SkillRegistry();
    skillRegistry.register(SupportiveConversationSkill);
    skillRegistry.register(CBTSkill);
    skillRegistry.register(GroundingSkill);
    skillRegistry.register(JournalingSkill);
    skillRegistry.register(ProgressReflectionSkill);
    skillRegistry.register(BreathingSkill);
    skillRegistry.register(SleepSupportSkill);
    skillRegistry.register(BehavioralActivationSkill);
    skillRegistry.register(PsychoeducationSkill);

    const policyGate = new SkillPolicyGate();
    const router = new DefaultClinicalRouter(skillRegistry, policyGate);
    
    // Real LLM (Gemini / Grok / OpenAI with fallback) or mock
    const hasLLMConfig = !!(process.env.GEMINI_API_KEY || process.env.GROK_API_KEY || process.env.OPENAI_API_KEY);
    const llmProvider = hasLLMConfig ? new FallbackStreamingLLM() : ({
        generateResponse: async () => ({
            response: "I hear you. Let's work through this together.",
            intent: 'supportive',
            safetyRelevant: false
        }),
        healthCheck: async () => true
    } as any);

    // Initialize Vector Stores: Prefer Qdrant if configured, fallback to Pinecone
    let knowledgeStore: VectorStore<KnowledgeMetadata> | undefined;
    let memoryStore: VectorStore<MemoryMetadata> | undefined;
    
    if (process.env.QDRANT_URL) {
        knowledgeStore = new QdrantKnowledgeStore();
        memoryStore = new QdrantMemoryStore();
        console.log('[INFO] Vector Store: Initialized Qdrant Vector Stores.');
    } else if (process.env.PINECONE_API_KEY) {
        knowledgeStore = new PineconeKnowledgeStore();
        memoryStore = new PineconeMemoryStore();
        console.log('[INFO] Vector Store: Initialized Pinecone Vector Stores.');
    }

    const memoryRepo = dbPool ? new PostgresMemoryRepository(dbPool, memoryStore) : new InMemoryMemoryRepository();
    const auditLogger = new MemoryAuditLogger();
    const memoryPolicyGate = new MemoryPolicyGate(memoryRepo, auditLogger);
    const toolGate = new AdvancedToolGate(
        memoryPolicyGate, 
        new MemoryMinimizer(), 
        undefined, 
        undefined, 
        knowledgeStore ? new RAGTool(new KnowledgeRetriever(knowledgeStore)) : undefined
    );
    const crisisBuilder = new CrisisResponseBuilder(new DefaultResourceResolver());
    const outputSafetyFilter = new OutputSafetyFilter({
        classify: async (text: string) => ({ ok: true, value: { safe: true, confidence: 1.0 } })
    } as any);
    
    const llmRuntime = new LLMRuntime(llmProvider, outputSafetyFilter, toolGate, crisisBuilder);
    
    const metricsCollector = new MetricsCollector();

    const factory = (stt: StreamingSTTProvider, tts: StreamingTTSProvider) => {
        const sessionStateMachine = new StateMachine();
        const orchestrator = new MindCareRuntime(
            pipeline,
            sessionStateMachine,
            router,
            skillRegistry,
            policyGate,
            llmRuntime,
            outputSafetyFilter,
            logger
        );
        const voiceStateMachine = new VoiceStateMachine();
        return new StreamingMindCareRuntime(orchestrator, stt, tts, voiceStateMachine, logger, metricsCollector);
    };

    const server = new RealtimeVoiceServer(factory, llmProvider);
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    server.start(port);
    
    console.log(`Deepgram STT: ${process.env.DEEPGRAM_API_KEY ? 'REAL' : 'MOCK'}`);
    console.log(`Gemini LLM: ${process.env.GEMINI_API_KEY ? 'REAL' : 'MOCK'}`);
    console.log(`Grok LLM: ${process.env.GROK_API_KEY ? 'REAL' : 'MOCK'}`);
    console.log(`ElevenLabs TTS: ${process.env.ELEVENLABS_API_KEY ? 'REAL' : 'MOCK'}`);
}
