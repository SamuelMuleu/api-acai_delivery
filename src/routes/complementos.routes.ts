import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ComplementoTipo } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Rota POST para criar múltiplos complementos
router.post('/', async (req, res): Promise<any> => {
    try {
        const complementosData = req.body;

        // Validação básica
        if (!Array.isArray(complementosData)) {
            return res.status(400).json({ error: 'O corpo da requisição deve ser um array de complementos' });
        }

        for (const complemento of complementosData) {
            if (!complemento.nome || !complemento.tipo || complemento.preco === undefined) {
                return res.status(400).json({
                    error: 'Cada complemento deve ter nome, tipo e preço',
                    complementoInvalido: complemento
                });
            }

            if (!Object.values(ComplementoTipo).includes(complemento.tipo)) {
                return res.status(400).json({
                    error: `Tipo de complemento inválido: ${complemento.tipo}`,
                    tiposValidos: Object.values(ComplementoTipo)
                });
            }
        }

        // Criar complementos no banco de dados
        const complementosCriados = await Promise.all(
            complementosData.map(complemento =>
                prisma.complemento.create({
                    data: {
                        nome: complemento.nome,
                        tipo: complemento.tipo,
                        preco: complemento.preco,
                        ativo: complemento.ativo !== undefined ? complemento.ativo : true
                    }
                })
            )
        );

        res.status(201).json(complementosCriados);
    } catch (error: unknown) {
        console.error('Erro ao criar complementos:', error);

        let errorMessage = 'Erro interno do servidor';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }

        res.status(500).json({
            error: 'Erro interno do servidor',
            message: errorMessage
        });
    }
});

// Rota GET para listar todos os complementos
router.get('/', async (req, res) => {
    try {
        const complementos = await prisma.complemento.findMany({
            orderBy: {
                nome: 'asc'
            }
        });
        res.json(complementos);
    } catch (error: unknown) {
        console.error('Erro ao buscar complementos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
router.delete('/:id', async (req, res): Promise<any> => {
    const id = Number(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
    }

    try {
        const complemento = await prisma.complemento.delete({
            where: { id },
        });

        res.json(complemento);
    } catch (error) {
        console.error('Erro ao excluir complemento:', error);

        if (error instanceof Error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;