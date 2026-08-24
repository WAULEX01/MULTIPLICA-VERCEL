# Multiplica PLUS v6.9.7

Sistema de gestão e acompanhamento de membros da IEAD Templo JK.

## Estrutura ativa

- `src/App.tsx`: shell, permissões e coordenação da sincronização.
- `src/views/`: telas funcionais do sistema.
- `src/services/db.ts`: modelos, cache local, autenticação e merge.
- `src/services/api.ts`: cliente da API e cálculo de deltas.
- `src/styles/multiplica-typeui.css`: design system TypeUI Power carregado por último.
- `public/api.php`: API e estrutura MySQL da hospedagem.
- `tests/`: autenticação, merge, deltas e segurança offline.
- `docs/VALIDACAO_V6.9.2.md`: escopo e resultados da validação.

## Desenvolvimento

Requer Node.js 20 ou superior.

```bash
npm ci
npm run dev
```

O modo local é seguro por padrão: não encaminha gravações para o banco de produção e remove Service Workers antigos de `localhost`. A conexão local com a API oficial só é habilitada quando `MULTIPLICA_USE_PRODUCTION_API=true` for informado explicitamente.

## Validação

```bash
npm test
npm run build
npm run lint
```

O lint ainda registra dívida técnica preexistente, detalhada no relatório. TypeScript, testes automatizados e build de produção são os gates principais desta versão.

## Publicação manual na Hostinger

1. Execute `npm run build`.
2. Faça backup do site e do banco de produção.
3. Envie somente o conteúdo de `dist/` para `public_html`.
4. Não envie `node_modules`, backups locais, credenciais em documentos, APKs, AABs ou ZIPs antigos.
5. Confirme a versão `v6.9.7`, a mesma revisão MySQL nos aparelhos, a reconciliação única do cache e uma gravação controlada em ambiente seguro.

O procedimento completo está em [`docs/VALIDACAO_V6.9.7.md`](docs/VALIDACAO_V6.9.7.md).

## Proteção de dados

O núcleo de sincronização foi auditado e mantido sem mudanças funcionais nesta modernização. Não execute testes destrutivos diretamente no banco de produção.
