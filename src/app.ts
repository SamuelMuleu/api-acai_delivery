import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { MulterError } from 'multer';
import authRoutes from './routes/auth.routes';
import produtosRoutes from './routes/produto.routes';
import pedidosRoutes from './routes/pedido.routes';
import complementosRoutes from './routes/complementos.routes';
import { swaggerUi, swaggerSpec } from './swagger';

export const app = express();

// CORS_ORIGIN: comma-separated list of allowed front-end origins (default: any)
const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: origins?.length ? origins : '*' }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/auth', authRoutes);
app.use('/produtos', produtosRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/complementos', complementosRoutes);

app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
});

// Express 5 forwards rejected promises from async handlers here
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
        return;
    }
    if (error instanceof MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter no máximo 5 MB.' : 'Envie uma imagem JPG, PNG, GIF ou WebP.';
        res.status(400).json({ error: message });
        return;
    }
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
};
app.use(errorHandler);
