import { Router } from 'express';
import { Prisma } from '@prisma/client';
import upload from '../config/multer';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';
import { uploadImage } from '../lib/cloudinary';

const router = Router();

const includeComplementos = { complementos: { include: { complemento: true } } } satisfies Prisma.ProdutoInclude;

type Tamanho = { nome: string; preco: number };

/** Parses the "tamanhos" multipart field: a JSON array of { nome, preco }. Returns null when invalid. */
function parseTamanhos(raw: unknown): Tamanho[] | null {
    if (typeof raw !== 'string') return null;
    try {
        const value = JSON.parse(raw);
        const valid =
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((t) => typeof t?.nome === 'string' && t.nome.trim() && typeof t.preco === 'number' && t.preco >= 0);
        return valid ? value.map((t: Tamanho) => ({ nome: t.nome.trim(), preco: t.preco })) : null;
    } catch {
        return null;
    }
}

const parseId = (value: string) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * @swagger
 * /produtos:
 *   get:
 *     summary: Lista os produtos com seus complementos
 *     tags: [Produtos]
 *     responses:
 *       200: { description: Lista de produtos }
 */
router.get('/', async (_req, res) => {
    const produtos = await prisma.produto.findMany({ include: includeComplementos, orderBy: { criadoEm: 'desc' } });
    res.json(produtos);
});

/**
 * @swagger
 * /produtos/{id}:
 *   get:
 *     summary: Retorna um produto pelo ID
 *     tags: [Produtos]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Produto }
 *       404: { description: Produto não encontrado }
 */
router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: 'ID inválido.' });
    const produto = await prisma.produto.findUnique({ where: { id }, include: includeComplementos });
    if (!produto) return void res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(produto);
});

/**
 * @swagger
 * /produtos:
 *   post:
 *     summary: Cria um produto (admin)
 *     tags: [Produtos]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [nome, tamanhos, imagem]
 *             properties:
 *               nome: { type: string, example: Açaí Tropical }
 *               descricao: { type: string }
 *               tamanhos: { type: string, example: '[{"nome":"300ml","preco":15}]' }
 *               imagem: { type: string, format: binary }
 *     responses:
 *       201: { description: Produto criado }
 *       400: { description: Dados inválidos }
 */
router.post('/', requireAdmin, upload.single('imagem'), async (req, res) => {
    const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
    const tamanhos = parseTamanhos(req.body.tamanhos);
    if (!nome) return void res.status(400).json({ error: 'Nome é obrigatório.' });
    if (!tamanhos) return void res.status(400).json({ error: 'Informe ao menos um tamanho com nome e preço.' });
    if (!req.file) return void res.status(400).json({ error: 'Imagem é obrigatória.' });

    const imagem = await uploadImage(req.file.buffer);
    const produto = await prisma.produto.create({
        data: { nome, descricao: req.body.descricao?.trim() || null, imagem, tamanhos },
    });
    res.status(201).json(produto);
});

/**
 * @swagger
 * /produtos/{id}:
 *   put:
 *     summary: Atualiza um produto (admin). Todos os campos são opcionais.
 *     tags: [Produtos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nome: { type: string }
 *               descricao: { type: string }
 *               tamanhos: { type: string }
 *               imagem: { type: string, format: binary }
 *     responses:
 *       200: { description: Produto atualizado }
 *       404: { description: Produto não encontrado }
 */
router.put('/:id', requireAdmin, upload.single('imagem'), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: 'ID inválido.' });
    if (!(await prisma.produto.findUnique({ where: { id } }))) {
        return void res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const data: Prisma.ProdutoUpdateInput = {};
    if (typeof req.body.nome === 'string' && req.body.nome.trim()) data.nome = req.body.nome.trim();
    if (typeof req.body.descricao === 'string') data.descricao = req.body.descricao.trim() || null;
    if (req.body.tamanhos !== undefined) {
        const tamanhos = parseTamanhos(req.body.tamanhos);
        if (!tamanhos) return void res.status(400).json({ error: 'Formato de tamanhos inválido.' });
        data.tamanhos = tamanhos;
    }
    // Before: req.file.path was used with memoryStorage, so the new image was never saved
    if (req.file) data.imagem = await uploadImage(req.file.buffer);

    const produto = await prisma.produto.update({ where: { id }, data, include: includeComplementos });
    res.json(produto);
});

/**
 * @swagger
 * /produtos/{id}:
 *   delete:
 *     summary: Remove um produto (admin). Produtos que já aparecem em pedidos não podem ser removidos.
 *     tags: [Produtos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       204: { description: Produto removido }
 *       404: { description: Produto não encontrado }
 *       409: { description: Produto usado em pedidos }
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: 'ID inválido.' });
    if (!(await prisma.produto.findUnique({ where: { id } }))) {
        return void res.status(404).json({ error: 'Produto não encontrado.' });
    }
    if (await prisma.pedidoProduto.count({ where: { produtoId: id } })) {
        return void res.status(409).json({ error: 'Este produto já aparece em pedidos e não pode ser removido.' });
    }
    await prisma.$transaction([
        prisma.produtoComplemento.deleteMany({ where: { produtoId: id } }),
        prisma.produto.delete({ where: { id } }),
    ]);
    res.status(204).end();
});

export default router;
