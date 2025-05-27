import { Router } from 'express';
import { pool } from '../db/connection';
import { PrismaClient } from '@prisma/client';
import upload from '../config/multer';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (_, res) => {
    try {
        const produtos = await prisma.produto.findMany({
            include: {
                complementos: {
                    include: {
                        complemento: true
                    }
                }
            },
            orderBy: {
                criadoEm: 'desc'
            }
        });


        const produtosFormatados = produtos.map(produto => ({
            ...produto,
            tamanhos: produto.tamanhos as Array<{ tamanho: string; preco: number }>
        }));

        res.json(produtosFormatados);
    } catch (error: unknown) {
        console.error('Erro ao buscar produtos:', error);

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        res.status(500).json({
            error: 'Erro ao buscar produtos',
            details: errorMessage
        });
    }
});
router.get('/:id', async (req, res): Promise<any> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
    }

    try {
        const produto = await prisma.produto.findUnique({
            where: { id },
            include: {
                complementos: {
                    include: {
                        complemento: true
                    }
                }
            }
        });

        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }


        produto.tamanhos = produto.tamanhos as Array<{ tamanho: string; preco: number }>;

        res.json(produto);
    } catch (error) {
        console.error('Erro ao buscar produto por ID:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
})

router.post('/', upload.single('imagem'), async (req, res): Promise<any> => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Imagem é obrigatória' });
        }

        const { nome, descricao, tamanhos } = req.body;

        if (!nome) {

            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        if (!tamanhos) {

            return res.status(400).json({ error: 'Tamanhos são obrigatórios' });
        }
        let tamanhosArray;
        try {
            tamanhosArray = JSON.parse(tamanhos);
            if (!Array.isArray(tamanhosArray)) {
                throw new Error('Formato inválido');
            }
        } catch (e) {

            return res.status(400).json({ error: 'Formato de tamanhos inválido' });
        }


        const tamanhosInvalidos = tamanhosArray.some(t =>
            !t.nome || typeof t.nome !== 'string' ||
            typeof t.preco !== 'number' || isNaN(t.preco)
        );

        if (tamanhosInvalidos) {

            return res.status(400).json({ error: 'Dados de tamanhos inválidos' });
        }

        const imagemURL = req.file.path;

        const novoProduto = await prisma.produto.create({
            data: {
                nome,
                descricao,
                imagem: imagemURL,
                tamanhos: tamanhosArray
            }
        });

        res.status(201).json(novoProduto);
    } catch (error) {
        console.error('Erro ao criar produto:', error);

        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', async (req, res): Promise<any> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
    }
    try {
        const produto = await prisma.produto.delete({
            where: { id },
        });

        if (produto.imagem) {
            const imagemPath = `public${produto.imagem}`;
            if (fs.existsSync(imagemPath)) {
                fs.unlinkSync(imagemPath);
            }
        }

        res.json(produto);
    } catch (error) {
        console.error('Erro ao excluir produto:', error);

        if (error instanceof Error) {
            return res.status(500).json({ error: error.message });
        } else {
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

});

export default router;
