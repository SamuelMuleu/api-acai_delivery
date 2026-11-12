import { Router } from 'express';
import { MetodoPagamento, PedidoStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isAdminRequest, requireAdmin } from '../lib/auth';

const router = Router();

const includeItens = {
    produtos: {
        include: {
            produto: { select: { id: true, nome: true, imagem: true } },
            complementos: { include: { complemento: true } },
        },
    },
} satisfies Prisma.PedidoInclude;

type PedidoComItens = Prisma.PedidoGetPayload<{ include: typeof includeItens }>;

const withTotal = (pedido: PedidoComItens) => ({
    ...pedido,
    // preco de cada item já inclui os complementos
    total: Number(pedido.produtos.reduce((sum, item) => sum + item.preco, 0).toFixed(2)),
});

class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

const MAX_ITENS = 50;
const text = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;

/**
 * @swagger
 * /pedidos:
 *   get:
 *     summary: Lista os pedidos (admin)
 *     tags: [Pedidos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de pedidos, mais recentes primeiro, com total }
 *       401: { description: Não autenticado }
 */
router.get('/', requireAdmin, async (_req, res) => {
    const pedidos = await prisma.pedido.findMany({ orderBy: { criadoEm: 'desc' }, include: includeItens });
    res.json(pedidos.map(withTotal));
});

/**
 * @swagger
 * /pedidos/{id}:
 *   get:
 *     summary: Acompanha um pedido. Sem token, telefone e endereço são omitidos.
 *     tags: [Pedidos]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Pedido }
 *       404: { description: Pedido não encontrado }
 */
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'ID do pedido inválido.' });
        return;
    }
    const pedido = await prisma.pedido.findUnique({ where: { id }, include: includeItens });
    if (!pedido) {
        res.status(404).json({ error: 'Pedido não encontrado.' });
        return;
    }
    const result = withTotal(pedido);
    if (isAdminRequest(req)) {
        res.json(result);
        return;
    }
    // Public tracking: never expose the customer's contact data
    const { telefone: _t, endereco: _e, ...publico } = result;
    res.json({ ...publico, nomeCliente: pedido.nomeCliente.split(' ')[0] });
});

/**
 * @swagger
 * /pedidos:
 *   post:
 *     summary: Cria um pedido. Os preços são calculados no servidor.
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nomeCliente, telefone, endereco, metodoPagamento, produtos]
 *             properties:
 *               nomeCliente: { type: string }
 *               telefone: { type: string }
 *               endereco: { type: string }
 *               metodoPagamento: { type: string, enum: [pix, dinheiro, cartao] }
 *               trocoPara: { type: number }
 *               produtos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [produtoId, tamanho]
 *                   properties:
 *                     produtoId: { type: integer }
 *                     tamanho: { type: string }
 *                     quantidade: { type: integer, default: 1 }
 *                     complementos: { type: array, items: { type: integer } }
 *     responses:
 *       201: { description: Pedido criado (com total) }
 *       400: { description: Dados inválidos }
 */
router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const nomeCliente = text(body.nomeCliente, 120);
    const telefone = typeof body.telefone === 'string' ? body.telefone.replace(/\D/g, '') : '';
    const endereco = text(body.endereco, 300);
    const metodoPagamento = body.metodoPagamento as MetodoPagamento;
    const produtos = body.produtos;

    if (!nomeCliente) return void res.status(400).json({ error: 'Informe o nome do cliente.' });
    if (!/^\d{10,11}$/.test(telefone)) return void res.status(400).json({ error: 'Telefone inválido (DDD + número).' });
    if (!endereco) return void res.status(400).json({ error: 'Informe o endereço de entrega.' });
    if (!Object.values(MetodoPagamento).includes(metodoPagamento)) {
        return void res.status(400).json({ error: 'Método de pagamento inválido.', validos: Object.values(MetodoPagamento) });
    }
    if (!Array.isArray(produtos) || produtos.length === 0) {
        return void res.status(400).json({ error: 'O pedido precisa ter ao menos um produto.' });
    }

    try {
        // Expand quantities into individual items (each one keeps its own size and complements)
        const itens: { produtoId: number; tamanho: string; complementos: number[] }[] = [];
        for (const item of produtos) {
            const quantidade = item?.quantidade === undefined ? 1 : Number(item.quantidade);
            if (!Number.isInteger(item?.produtoId) || typeof item?.tamanho !== 'string' || !Number.isInteger(quantidade) || quantidade < 1) {
                throw new HttpError(400, 'Item de produto inválido.');
            }
            const complementos = Array.isArray(item.complementos) ? item.complementos : [];
            if (!complementos.every((c: unknown) => Number.isInteger(c))) throw new HttpError(400, 'Complementos inválidos.');
            for (let i = 0; i < quantidade; i++) itens.push({ produtoId: item.produtoId, tamanho: item.tamanho, complementos });
        }
        if (itens.length > MAX_ITENS) throw new HttpError(400, `Máximo de ${MAX_ITENS} itens por pedido.`);

        const produtoIds = [...new Set(itens.map((i) => i.produtoId))];
        const complementoIds = [...new Set(itens.flatMap((i) => i.complementos))];
        const [produtosDb, complementosDb] = await Promise.all([
            prisma.produto.findMany({ where: { id: { in: produtoIds } } }),
            prisma.complemento.findMany({ where: { id: { in: complementoIds }, ativo: true } }),
        ]);

        const precificados = itens.map((item) => {
            const produto = produtosDb.find((p) => p.id === item.produtoId);
            if (!produto) throw new HttpError(400, `Produto ${item.produtoId} não encontrado.`);
            const tamanhos = produto.tamanhos as unknown as { nome: string; preco: number }[];
            const tamanho = tamanhos.find((t) => t.nome === item.tamanho);
            if (!tamanho) throw new HttpError(400, `Tamanho "${item.tamanho}" indisponível para ${produto.nome}.`);
            const precoComplementos = item.complementos.reduce((sum, id) => {
                const complemento = complementosDb.find((c) => c.id === id);
                if (!complemento) throw new HttpError(400, `Complemento ${id} indisponível.`);
                return sum + complemento.preco;
            }, 0);
            return { ...item, preco: Number((tamanho.preco + precoComplementos).toFixed(2)) };
        });

        const total = precificados.reduce((sum, i) => sum + i.preco, 0);
        let trocoPara: number | null = null;
        if (metodoPagamento === 'dinheiro' && body.trocoPara !== undefined && body.trocoPara !== null) {
            trocoPara = Number(body.trocoPara);
            if (!Number.isFinite(trocoPara) || trocoPara < total) {
                throw new HttpError(400, 'O valor para troco deve ser maior ou igual ao total do pedido.');
            }
        }

        const pedido = await prisma.pedido.create({
            data: {
                nomeCliente,
                telefone,
                endereco,
                metodoPagamento,
                trocoPara,
                produtos: {
                    create: precificados.map((item) => ({
                        produto: { connect: { id: item.produtoId } },
                        tamanho: item.tamanho,
                        preco: item.preco,
                        complementos: { create: item.complementos.map((id) => ({ complemento: { connect: { id } } })) },
                    })),
                },
            },
            include: includeItens,
        });

        res.status(201).json(withTotal(pedido));
    } catch (error) {
        if (error instanceof HttpError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        throw error;
    }
});

/**
 * @swagger
 * /pedidos/{id}/status:
 *   patch:
 *     summary: Atualiza o status do pedido (admin)
 *     tags: [Pedidos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [pendente, preparo, saiu, entregue] }
 *     responses:
 *       200: { description: Pedido atualizado }
 *       400: { description: Status inválido }
 *       404: { description: Pedido não encontrado }
 */
router.patch('/:id/status', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status as PedidoStatus;
    if (!Number.isInteger(id) || id <= 0) return void res.status(400).json({ error: 'ID do pedido inválido.' });
    if (!Object.values(PedidoStatus).includes(status)) {
        return void res.status(400).json({ error: 'Status inválido.', validos: Object.values(PedidoStatus) });
    }
    try {
        const pedido = await prisma.pedido.update({ where: { id }, data: { status }, include: includeItens });
        res.json(withTotal(pedido));
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            res.status(404).json({ error: 'Pedido não encontrado.' });
            return;
        }
        throw error;
    }
});

export default router;
