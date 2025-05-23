"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("../config/multer"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
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
            tamanhos: produto.tamanhos
        }));
        res.json(produtosFormatados);
    }
    catch (error) {
        console.error('Erro ao buscar produtos:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        res.status(500).json({
            error: 'Erro ao buscar produtos',
            details: errorMessage
        });
    }
});
router.post('/', multer_1.default.single('imagem'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nome e tamanhos são obrigatórios' });
        }
        const { nome, descricao, imagem, tamanhos } = req.body;
        // Validação básica
        if (!nome || !tamanhos) {
            return res.status(400).json({ error: 'Dados inválidos' });
        }
        let tamanhosArray;
        try {
            tamanhosArray = typeof tamanhos === 'string' ? JSON.parse(tamanhos) : tamanhos;
        }
        catch (e) {
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
    }
    catch (error) {
        console.error('Erro ao criar produto:', error);
        if (req.file) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
exports.default = router;
