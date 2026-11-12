import { Router } from 'express';
import { issueToken, safeEqual } from '../lib/auth';

const router = Router();

// Simple in-memory throttle against password guessing
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login do administrador (retorna um token Bearer válido por 12h)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token gerado
 *       401:
 *         description: Senha incorreta
 *       429:
 *         description: Muitas tentativas
 */
router.post('/login', (req, res) => {
    const ip = req.ip ?? 'unknown';
    const entry = attempts.get(ip);
    if (entry && entry.count >= MAX_ATTEMPTS && entry.until > Date.now()) {
        res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
        return;
    }

    const expected = process.env.ADMIN_PASSWORD;
    const { password } = req.body ?? {};
    if (!expected) {
        res.status(500).json({ error: 'ADMIN_PASSWORD não configurada no servidor.' });
        return;
    }

    if (typeof password !== 'string' || !safeEqual(password, expected)) {
        const count = (entry && entry.until > Date.now() ? entry.count : 0) + 1;
        attempts.set(ip, { count, until: Date.now() + BLOCK_MS });
        res.status(401).json({ error: 'Senha incorreta.' });
        return;
    }

    attempts.delete(ip);
    res.json(issueToken());
});

export default router;
