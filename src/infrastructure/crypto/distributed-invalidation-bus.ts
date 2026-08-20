import { EventEmitter } from 'events';

export interface InvalidationEvent {
  action: 'EVICT_USER_KEYS';
  userId: string;
  timestamp: Date;
}

export interface DistributedInvalidationBus {
  publish(event: InvalidationEvent): Promise<void>;
  subscribe(handler: (event: InvalidationEvent) => void): void;
}

/**
 * In-Memory Pub/Sub Bus for local multi-instance testing and single-node setups.
 */
export class InMemoryInvalidationBus implements DistributedInvalidationBus {
  private emitter = new EventEmitter();

  async publish(event: InvalidationEvent): Promise<void> {
    this.emitter.emit('invalidation', event);
  }

  subscribe(handler: (event: InvalidationEvent) => void): void {
    this.emitter.on('invalidation', handler);
  }
}
