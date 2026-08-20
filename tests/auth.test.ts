import { describe, it, expect } from 'vitest';
import { JWTService } from '../src/infrastructure/auth/jwt-service.js';
import { WSTicketService } from '../src/infrastructure/auth/ws-ticket-service.js';
import jwt from 'jsonwebtoken';

describe('Phase 8: Authentication & Ticket Security', () => {
    const jwtService = new JWTService();
    const wstService = new WSTicketService(); // No Redis = local fallback

    it('should generate and verify a valid JWT', async () => {
        const token = jwtService.sign({ sub: 'user-123', role: 'patient' });
        const payload = await jwtService.verify(token);
        
        expect(payload.sub).toBe('user-123');
        expect(payload.role).toBe('patient');
    });

    it('should reject expired tokens', async () => {
        const token = jwtService.sign({ sub: 'user-123', role: 'patient' }, -10); // Expires in the past
        await expect(jwtService.verify(token)).rejects.toThrow('Authentication failed: jwt expired');
    });

    it('should reject tampered tokens', async () => {
        const token = jwtService.sign({ sub: 'user-123', role: 'patient' });
        const badToken = token + 'tamper';
        await expect(jwtService.verify(badToken)).rejects.toThrow(/Authentication failed/);
    });

    it('should reject invalid signatures', async () => {
        const token = jwt.sign({ sub: 'user-123', role: 'patient' }, 'wrong-secret');
        await expect(jwtService.verify(token)).rejects.toThrow(/Authentication failed/);
    });

    it('Issues and consumes a valid WebSocket Ticket', async () => {
        const payload = { sub: 'u1', role: 'USER' };
        const ticket = await wstService.generateTicket(payload);
        
        const retrieved = await wstService.consumeTicket(ticket);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.sub).toBe('u1');
    });

    it('Enforces single-use for WebSocket Tickets', async () => {
        const payload = { sub: 'u1', role: 'USER' };
        const ticket = await wstService.generateTicket(payload);
        
        // First consume works
        expect(await wstService.consumeTicket(ticket)).not.toBeNull();
        
        // Second consume fails
        expect(await wstService.consumeTicket(ticket)).toBeNull();
    });

    it('Rejects completely invalid tickets', async () => {
        expect(await wstService.consumeTicket('random-garbage')).toBeNull();
    });
});
