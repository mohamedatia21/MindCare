import { MemoryObject } from './types.js';

export interface MemoryRepository {
  // Enforces tenant isolation by requiring userId alongside memoryId
  save(userId: string, memory: MemoryObject): Promise<void>;
  find(userId: string, memoryId: string): Promise<MemoryObject | null>;
  findMany(userId: string): Promise<MemoryObject[]>;
  update(userId: string, memoryId: string, updates: Partial<MemoryObject>): Promise<void>;
  // Logical soft deletion inside the repo
  softDelete(userId: string, memoryId: string): Promise<void>;
  
  // GDPR Hard Purge / Right to be Forgotten
  purgeAllUserData(userId: string): Promise<void>;
  
  // Semantic search via pgvector (or dummy implementation for in-memory)
  findSimilar?(userId: string, embedding: number[], limit?: number): Promise<MemoryObject[]>;
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private store: Map<string, MemoryObject> = new Map();

  save(userId: string, memory: MemoryObject): Promise<void> {
    if (memory.userId !== userId) return Promise.reject(new Error("Tenant mismatch"));
    this.store.set(memory.id, { ...memory });
    return Promise.resolve();
  }

  find(userId: string, memoryId: string): Promise<MemoryObject | null> {
    const mem = this.store.get(memoryId);
    // Hard Tenant Isolation Boundary inside the DB Adapter
    if (!mem || mem.userId !== userId) return Promise.resolve(null);
    return Promise.resolve({ ...mem });
  }

  findMany(userId: string): Promise<MemoryObject[]> {
    return Promise.resolve(Array.from(this.store.values())
      .filter(m => m.userId === userId && m.status !== 'DELETED')
      .map(m => ({ ...m })));
  }

  async update(userId: string, memoryId: string, updates: Partial<MemoryObject>): Promise<void> {
    const mem = await this.find(userId, memoryId);
    if (!mem) throw new Error("Memory not found or tenant mismatch");
    this.store.set(memoryId, { ...mem, ...updates, updatedAt: new Date() });
  }

  async softDelete(userId: string, memoryId: string): Promise<void> {
    const mem = await this.find(userId, memoryId);
    if (!mem) return;
    this.store.set(memoryId, { ...mem, status: 'DELETED', updatedAt: new Date() });
  }

  async purgeAllUserData(userId: string): Promise<void> {
    for (const [id, mem] of Array.from(this.store.entries())) {
      if (mem.userId === userId) {
        this.store.delete(id);
      }
    }
  }
}
