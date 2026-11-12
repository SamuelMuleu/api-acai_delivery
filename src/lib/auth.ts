import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function secret() {
    const value = process.env.ADMIN_TOKEN_SECRET;
    if (!value || value.length < 32) {
        throw new Error('ADMIN_TOKEN_SECRET precisa ter pelo menos 32 caracteres.');
    }
    return value;
}

function sign(payload: string) {
    return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Compares strings in constant time to avoid leaking information through timing. */
export function safeEqual(a: string, b: string) {
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
}

export function issueToken() {
    const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
    return { token: `${payload}.${sign(payload)}`, expiresIn: TOKEN_TTL_MS / 1000 };
}

export function isValidToken(token: string | undefined): boolean {
    if (!token) return false;
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return data.role === 'admin' && typeof data.exp === 'number' && data.exp > Date.now();
    } catch {
        return false;
    }
}

export function isAdminRequest(req: Request) {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? isValidToken(header.slice(7)) : false;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!isAdminRequest(req)) {
        res.status(401).json({ error: 'Acesso restrito ao administrador.' });
        return;
    }
    next();
}
