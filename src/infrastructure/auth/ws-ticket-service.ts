import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { JWTPayload } from './jwt-service.js';

export class WSTicketService {
    // Ticket valid for 10 seconds
    private readonly TICKET_TTL_SEC = 10;

    constructor(private redis?: Redis) {
        if (!this.redis) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error(
                    'FATAL: WSTicketService requires Redis/Valkey in production. ' +
                    'Set VALKEY_URL or REDIS_URL. In-memory fallback is NOT safe for production ' +
                    '(causes split-brain ticket failures across load-balanced instances).'
                );
            }
            console.warn("WSTicketService initialized without Redis (Valkey). Defaulting to in-memory fallback. NOT FOR PRODUCTION.");
        }
    }

    // Fallback for local dev if Valkey is not provided
    private localTickets = new Map<string, { payload: JWTPayload, expiresAt: number }>();

    async generateTicket(payload: JWTPayload): Promise<string> {
        const ticket = randomBytes(32).toString('hex');
        
        if (this.redis) {
            try {
                // Store in Valkey with 10s EXPIRE
                await this.redis.set(`wst:${ticket}`, JSON.stringify(payload), 'EX', this.TICKET_TTL_SEC);
                return ticket;
            } catch {
                // Redis unavailable – fall through to in-memory
            }
        }

        this.localTickets.set(ticket, {
            payload,
            expiresAt: Date.now() + this.TICKET_TTL_SEC * 1000
        });
        return ticket;
    }

    async consumeTicket(ticket: string): Promise<JWTPayload | null> {
        if (this.redis) {
            try {
                // Atomic GETDEL (requires Redis 6.2+)
                const data = await this.redis.call('GETDEL', `wst:${ticket}`) as string | null;
                if (!data) return null;
                try {
                    return JSON.parse(data) as JWTPayload;
                } catch {
                    return null;
                }
            } catch {
                // Redis unavailable – fall through to in-memory
            }
        }

        const data = this.localTickets.get(ticket);
        if (!data) return null;

        // Single-use: immediately remove it
        this.localTickets.delete(ticket);

        if (Date.now() > data.expiresAt) {
            return null;
        }
        return data.payload;
    }
}
