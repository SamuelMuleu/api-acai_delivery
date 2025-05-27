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
router.post('/', upload.single('imagem'), async (req, res): Promise<any> => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Imagem é obrigatória' });
        }

        const { nome, descricao, tamanhos } = req.body;

        if (!nome) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        if (!tamanhos) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Tamanhos são obrigatórios' });
        }
        let tamanhosArray;
        try {
            tamanhosArray = JSON.parse(tamanhos);
            if (!Array.isArray(tamanhosArray)) {
                throw new Error('Formato inválido');
            }
        } catch (e) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Formato de tamanhos inválido' });
        }


        const tamanhosInvalidos = tamanhosArray.some(t =>
            !t.nome || typeof t.nome !== 'string' ||
            typeof t.preco !== 'number' || isNaN(t.preco)
        );

        if (tamanhosInvalidos) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Dados de tamanhos inválidos' });
        }

        const imagemPath = `/uploads/${req.file.filename}`;

        const novoProduto = await prisma.produto.create({
            data: {
                nome,
                descricao,
                imagem: imagemPath,
                tamanhos: tamanhosArray
            }
        });

        res.status(201).json(novoProduto);
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;
