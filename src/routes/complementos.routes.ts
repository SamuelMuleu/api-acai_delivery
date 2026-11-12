import { Router } from 'express';
import { ComplementoTipo, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isAdminRequest, requireAdmin } from '../lib/auth';

const router = Router();

const parseId = (value: string) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

function validate(c: Record<string, unknown>, partial = false): string | null {
    if ((!partial || c.nome !== undefined) && (typeof c.nome !== 'string' || !c.nome.trim())) return 'Nome é obrigatório.';
    if ((!partial || c.tipo !== undefined) && !Object.values(ComplementoTipo).includes(c.tipo as ComplementoTipo)) {
        return `Tipo inválido. Use: ${Object.values(ComplementoTipo).join(', ')}.`;
    }
    if ((!partial || c.preco !== undefined) && (typeof c.preco !== 'number' || c.preco < 0)) return 'Preço inválido.';
    if (c.ativo !== undefined && typeof c.ativo !== 'boolean') return 'O campo ativo deve ser true ou false.';
    return null;
}

/**
 * @swagger
 * /complementos:
 *   get:
 *     summary: Lista os complementos (inativos aparecem apenas para o admin)
 *     tags: [Complementos]
 *     responses:
 *       200: { description: Lista de complementos }
 */
router.get('/', async (req, res) => {
    const complementos = await prisma.complemento.findMany({
        where: isAdminRequest(req) ? {} : { ativo: true },
        orderBy: { nome: 'asc' },
    });
    res.json(complementos);
});

/**
 * @swagger
 * /complementos/{id}:
 *   get:
 *     summary: Retorna um complemento
 *     tags: [Complementos]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Complemento }
 *       404: { description: Não encontrado }
 */
router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: 'ID inválido.' });
    const complemento = await prisma.complemento.findUnique({ where: { id } });
    if (!complemento) return void res.status(404).json({ error: 'Complemento não encontrado.' });
    res.json(complemento);
});

/**
 * @swagger
 * /complementos:
 *   post:
 *     summary: Cria um ou vários complementos (admin)
 *     tags: [Complementos]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 nome: { type: string, example: Granola }
 *                 tipo: { type: string, enum: [fruta, cobertura, adicional] }
 *                 preco: { type: number, example: 2.5 }
 *                 ativo: { type: boolean }
 *     responses:
 *       201: { description: Complementos criados }
 *       400: { description: Dados inválidos }
 */
router.post('/', requireAdmin, async (req, res) => {
    const lista = Array.isArray(req.body) ? req.body : [req.body];
    if (lista.length === 0) return void res.status(400).json({ error: 'Envie ao menos um complemento.' });
    for (const c of lista) {
        const error = validate(c ?? {});
        if (error) return void res.status(400).json({ error, complemento: c });
    }
    const criados = await prisma.$transaction(
        lista.map((c) =>
            prisma.complemento.create({
                data: { nome: c.nome.trim(), tipo: c.tipo, preco: c.preco, ativo: c.ativo ?? true },
            })
        )
    );
    res.status(201).json(criados);
});

/**
 * @swagger
 * /complementos/{id}:
 *   patch:
 *     summary: Atualiza um complemento (admin)
 *     tags: [Complementos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Complemento atualizado }
 *       404: { description: Não encontrado }
 */
router.patch('/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: 'ID inválido.' });
    const error = validate(req.body ?? {}, true);
    if (error) return void res.status(400).json({ error });
    const { nome, tipo, preco, ativo } = req.body;
    try {
        const complemento = await prisma.complemento.update({
            where: { id },
            data: { nome: nome?.trim(), tipo, preco, ativo },
        });
        res.json(complemento);
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
            return void res.status(404).json({ error: 'Complemento não encontrado.' });
        }
        throw e;
    }
});

/**
 * @swagger
 * /complementos/{id}:
 *   delete:
 *     summary: Remove um complemento (admin). Se já foi usado em pedidos, é apenas desativado.
 *     tags: [Complementos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Complemento desativado (usado em pedidos) }
 *       204: { description: Complemento removido }
 *       404: { description: Não encontrado }
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: 'ID inválido.' });
    if (!(await prisma.complemento.findUnique({ where: { id } }))) {
        return void res.status(404).json({ error: 'Complemento não encontrado.' });
    }
    // Keeps order history intact: complements already ordered are deactivated instead of deleted
    if (await prisma.pedidoProdutoComplemento.count({ where: { complementoId: id } })) {
        const complemento = await prisma.complemento.update({ where: { id }, data: { ativo: false } });
        return void res.json({ ...complemento, aviso: 'Complemento usado em pedidos: foi desativado em vez de removido.' });
    }
    await prisma.$transaction([
        prisma.produtoComplemento.deleteMany({ where: { complementoId: id } }),
        prisma.complemento.delete({ where: { id } }),
    ]);
    res.status(204).end();
});

export default router;
