# API Açaí Delivery

API REST de uma açaiteria: cardápio (produtos com tamanhos e complementos), pedidos com preço calculado no servidor, acompanhamento de pedido e painel administrativo. Front-end: [acai-delivery](https://github.com/SamuelMuleu/acai-delivery).

**Stack:** Node.js · Express 5 · TypeScript · Prisma · PostgreSQL · Cloudinary · Swagger

Documentação interativa em `/docs` (Swagger).

## Endpoints

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | público | `{ password }` → token Bearer (12h). Limite de 5 tentativas a cada 15 min |
| `GET` | `/produtos`, `/produtos/:id` | público | Cardápio |
| `POST` / `PUT` / `DELETE` | `/produtos[/:id]` | admin | `multipart/form-data` com `nome`, `descricao`, `tamanhos` (JSON) e `imagem` |
| `GET` | `/complementos` | público | Só os ativos (o admin vê todos) |
| `POST` / `PATCH` / `DELETE` | `/complementos[/:id]` | admin | Complemento já usado em pedidos é desativado em vez de removido |
| `POST` | `/pedidos` | público | Cria o pedido; aceita `quantidade` e `trocoPara` e retorna o `total` |
| `GET` | `/pedidos/:id` | público | Acompanhamento. Sem token, telefone e endereço não são retornados |
| `GET` | `/pedidos` | admin | Todos os pedidos com total |
| `PATCH` | `/pedidos/:id/status` | admin | `pendente` → `preparo` → `saiu` → `entregue` |

Regras importantes:

- Os preços **nunca** vêm do cliente: o servidor calcula tamanho + complementos ativos.
- Produtos que já aparecem em pedidos não podem ser removidos (`409`), para preservar o histórico.
- Erros retornam `{ "error": "mensagem" }` com o status HTTP adequado.

## Rodando localmente

```bash
cp .env.example .env      # preencha as variáveis
npm install
npx prisma migrate deploy
npm run dev               # http://localhost:3333/docs
```

## Testes

```bash
npm test
```

Sobe um PostgreSQL embutido (o binário é baixado na primeira execução), aplica as migrations e roda 30 testes de integração cobrindo autenticação, cálculo de preços, privacidade do rastreio, status e regras de exclusão.

## Deploy (Render, Railway…)

- Build: `npm install && npm run build`
- Start: `npm start` (aplica as migrations e sobe a API)
- Variáveis: as do `.env.example`. **`ADMIN_PASSWORD` e `ADMIN_TOKEN_SECRET` são obrigatórias** para o painel funcionar.
