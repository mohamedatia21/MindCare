import { RuntimeLogger } from './runtime-logger.js';

export interface TurnLatencyMetrics {
  turnId: string;
  sessionId: string;
  ttfaMs?: number;               // Time to First Audio (Physical audio out to user)
  ttstMs?: number;               // Time to Speech-to-Text final
  llmFirstTokenMs?: number;      // Time to first LLM token
  ttsFirstAudioChunkMs?: number; // Time from text-in to first TTS chunk
  totalTurnMs?: number;          // Total end-to-end turn latency
  bargeInTriggered?: boolean;
}

export interface SystemHealthMetrics {
  activeSessions: number;
  valkeyLockContentionCount: number;
  rlsViolationsCount: number;
  crisisEscalationsCount: number;
  mcpExecutionsCount: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private logger = new RuntimeLogger();

  private health: SystemHealthMetrics = {
    activeSessions: 0,
    valkeyLockContentionCount: 0,
    rlsViolationsCount: 0,
    crisisEscalationsCount: 0,
    mcpExecutionsCount: 0
  };

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public recordTurnLatency(metrics: TurnLatencyMetrics): void {
    // Strictly anonymized: Turn ID + Numerical Latency. ZERO text, ZERO transcripts, ZERO PII.
    this.logger.info('RealtimeTurnLatencyMetric', {
      requestId: metrics.turnId,
      sessionId: metrics.sessionId,
      ttfa: metrics.ttfaMs,
      ttst: metrics.ttstMs,
      llmFirstToken: metrics.llmFirstTokenMs,
      ttsFirstAudio: metrics.ttsFirstAudioChunkMs,
      totalTurnLatency: metrics.totalTurnMs,
      bargeIn: metrics.bargeInTriggered ? 'TRUE' : 'FALSE',
      timestamp: new Date()
    });
  }

  public incrementCrisisEscalation(): void {
    this.health.crisisEscalationsCount++;
    this.logger.warn('MetricCrisisEscalated', {
      requestId: 'metric',
      totalCrisisCount: this.health.crisisEscalationsCount,
      timestamp: new Date()
    });
  }

  public incrementLockContention(): void {
    this.health.valkeyLockContentionCount++;
    this.logger.warn('MetricValkeyLockContention', {
      requestId: 'metric',
      totalContentionCount: this.health.valkeyLockContentionCount,
      timestamp: new Date()
    });
  }

  public getSnapshot(): SystemHealthMetrics {
    return { ...this.health };
  }
}
