import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export interface JWTPayload {
    sub: string;
    role?: string;
    [key: string]: any;
}

export interface AuthenticatedUserContext {
    userId: string;
    sessionId: string;
    role: string;
    authenticatedAt: Date;
    languagePreference?: 'ENGLISH' | 'EGYPTIAN_ARABIC';
}

export class JWTService {
    private readonly jwksUri?: string | undefined;
    private readonly issuer?: string | undefined;
    private readonly audience?: string | undefined;
    private readonly jwksClient?: jwksClient.JwksClient | undefined;
    
    // For test/dev fallback
    private readonly secret: string;

    constructor() {
        this.jwksUri = process.env.IDP_JWKS_URI;
        this.issuer = process.env.IDP_ISSUER;
        this.audience = process.env.IDP_AUDIENCE;
        this.secret = process.env.JWT_SECRET || 'mindcare-local-dev-jwt-secret-minimum-32-chars-long';
        
        const isTest = process.env.NODE_ENV === 'test';
        const hasIdpConfig = !!(this.jwksUri && this.issuer && this.audience);

        if (!isTest && hasIdpConfig) {
            this.jwksClient = jwksClient({
                jwksUri: this.jwksUri,
                cache: true,
                cacheMaxEntries: 5,
                cacheMaxAge: 600000 // 10m
            });
        } else if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_INSECURE_AUTH) {
            throw new Error('FATAL: Production authentication requires IDP_JWKS_URI, IDP_ISSUER, and IDP_AUDIENCE.');
        }
    }

    private get usesRealIdp(): boolean {
        return !!this.jwksClient;
    }

    private async getKey(header: jwt.JwtHeader): Promise<string | Buffer> {
        if (!this.usesRealIdp || header.alg === 'HS256') {
            return this.secret;
        }
        
        return new Promise((resolve, reject) => {
            if (!this.jwksClient) return reject(new Error('JWKS Client not initialized'));
            if (!header.kid) return reject(new Error('Missing kid in JWT header'));
            
            this.jwksClient.getSigningKey(header.kid, (err, key) => {
                if (err) return reject(err);
                if (!key) return reject(new Error('Key not found'));
                const signingKey = key.getPublicKey();
                resolve(signingKey);
            });
        });
    }

    async verify(token: string): Promise<JWTPayload> {
        return new Promise((resolve, reject) => {
            const decodedHeader = jwt.decode(token, { complete: true })?.header;
            const isLocal = !this.usesRealIdp || decodedHeader?.alg === 'HS256';

            const options: jwt.VerifyOptions = {};
            if (!isLocal) {
                options.issuer = this.issuer;
                options.audience = this.audience;
                options.algorithms = ['RS256'];
            } else {
                options.issuer = 'mindcare-auth';
                options.audience = 'mindcare-realtime';
                options.algorithms = ['HS256'];
            }
            
            jwt.verify(token, (header, cb) => {
                this.getKey(header).then(key => cb(null, key)).catch(err => cb(err));
            }, options, (err, decoded) => {
                if (err) {
                    return reject(new Error(`Authentication failed: ${err.message}`));
                }
                
                const payload = decoded as JWTPayload;
                if (!payload.sub) {
                    return reject(new Error('Authentication failed: missing subject (sub)'));
                }
                resolve(payload);
            });
        });
    }

    sign(payload: JWTPayload, expiresInSeconds: number = 3600): string {
        if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_INSECURE_AUTH) {
            throw new Error('JWTService.sign cannot be used in production or when IDP is configured. Tokens must come from an external IdP.');
        }
        return jwt.sign(payload, this.secret, { 
            expiresIn: expiresInSeconds,
            issuer: 'mindcare-auth',
            audience: 'mindcare-realtime',
            algorithm: 'HS256'
        });
    }
}
