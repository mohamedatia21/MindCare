import crypto from 'crypto';

export interface PurgeTombstone {
  token: string;
  pepperVersion: string;
  timestamp: Date;
}

export interface CstKeyStore {
  getOrCreateCst(userId: string): Promise<Buffer>;
  getCst(userId: string): Promise<Buffer | null>;
  shredCst(userId: string): Promise<PurgeTombstone>;
  matchTombstone(candidateUserId: string, tombstone: PurgeTombstone): boolean;
}

export class InMemoryCstKeyStore implements CstKeyStore {
  private store: Map<string, Buffer> = new Map();
  private peppers: Map<string, string> = new Map();
  private currentPepperVersion = 'v1';

  constructor(initialPepper?: string) {
    const pepper = initialPepper || process.env.AUDIT_PURGE_PEPPER;
    if (!pepper) {
      throw new Error(
        "FATAL_CONFIG_ERROR: AUDIT_PURGE_PEPPER is mandatory and must be configured in environment or provided explicitly. Zero fallback secrets permitted."
      );
    }
    this.peppers.set('v1', pepper);
  }

  async getOrCreateCst(userId: string): Promise<Buffer> {
    const existing = this.store.get(userId);
    if (existing) {
      return Buffer.from(existing);
    }
    const newCst = crypto.randomBytes(32);
    this.store.set(userId, newCst);
    return Buffer.from(newCst);
  }

  async getCst(userId: string): Promise<Buffer | null> {
    const existing = this.store.get(userId);
    return existing ? Buffer.from(existing) : null;
  }

  async shredCst(userId: string): Promise<PurgeTombstone> {
    const existing = this.store.get(userId);
    if (existing) {
      // Overwrite buffer with zeroes before delete
      existing.fill(0);
      this.store.delete(userId);
    }

    const pepper = this.peppers.get(this.currentPepperVersion);
    if (!pepper) {
      throw new Error(`FATAL_PEPPER_ERROR: Pepper version ${this.currentPepperVersion} not found in keystore`);
    }

    const hmac = crypto.createHmac('sha256', pepper);
    hmac.update(userId);
    const token = hmac.digest('hex');

    return {
      token,
      pepperVersion: this.currentPepperVersion,
      timestamp: new Date()
    };
  }

  matchTombstone(candidateUserId: string, tombstone: PurgeTombstone): boolean {
    const pepper = this.peppers.get(tombstone.pepperVersion);
    if (!pepper) return false;

    const hmac = crypto.createHmac('sha256', pepper);
    hmac.update(candidateUserId);
    const expectedToken = hmac.digest('hex');

    return crypto.timingSafeEqual(Buffer.from(tokenToHex(expectedToken)), Buffer.from(tokenToHex(tombstone.token)));
  }

  public setPepper(version: string, secret: string, makeCurrent: boolean = true) {
    this.peppers.set(version, secret);
    if (makeCurrent) this.currentPepperVersion = version;
  }
}

function tokenToHex(token: string): string {
  return token.length % 2 === 0 ? token : '0' + token;
}
