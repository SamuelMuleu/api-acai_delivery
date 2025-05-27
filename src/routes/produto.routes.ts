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
                        complemento: true // Inclui os detalhes dos complementos associados
                    }
                }
            },
            orderBy: {
                criadoEm: 'desc' // Ordena do mais recente para o mais antigo
            }
        });

        // Formata os tamanhos (que estão como JSON no banco)
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
            return res.status(400).json({ error: 'Nome e tamanhos são obrigatórios' });
        }
        const { nome, descricao, tamanhos } = req.body;


        // Validação básica
        if (!nome || !tamanhos) {
            return res.status(400).json({ error: 'Dados inválidos' });
        }


        let tamanhosArray;
        try {
            tamanhosArray = typeof tamanhos === 'string' ? JSON.parse(tamanhos) : tamanhos;
        } catch (e) {
            return res.status(400).json({ error: 'Formato de tamanhos inválido' });
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
