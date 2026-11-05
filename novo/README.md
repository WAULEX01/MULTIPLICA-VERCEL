# Multiplica Plus — nova experiência 0.1

Prévia funcional para avaliar o novo CRM da IEAD · Templo JK. Usa **dados fictícios**. Não acessa o Supabase, a Hostinger ou a API do aplicativo atual. Não é uma versão pronta para operação da igreja.

## Executar

Requer Node.js 22 ou 24. Execute `npm ci`, `npm run dev` e abra o endereço mostrado. `npm run build` verifica TypeScript e produz `dist/`, pronto para Vercel.

## Telas e interações

- `#painel`: indicadores derivados dos registros visíveis, cuidado pendente, chamadas recentes e aniversários.
- `#membros`: busca, filtros, cadastro, edição e arquivamento pelo campo Situação. Uma pessoa pode ter vários departamentos.
- `#chamada`: departamento, data, tipo, presença individual, marcar todos, gravação e reabertura.
- `#cuidado`: pessoas atribuídas, mensagem/ligação/visita e histórico de contatos.
- `#departamentos`: sete departamentos e contagens sem duplicar pessoas no total geral.
- `#ajustes`: simulação dos quatro perfis. **É uma visualização do produto, não um mecanismo de segurança.**

Registros locais usam IndexedDB por entidade; BroadcastChannel avisa outras abas do mesmo navegador e origem. Isso não sincroniza aparelhos ou contas diferentes. Dados persistem somente naquele navegador. A identidade Pr. Wagner no cabeçalho é uma identificação da prévia, não uma sessão autenticada.

## Desempenho e atualização

Cada tela usa importação dinâmica. Fontes ficam hospedadas junto do aplicativo; não há fontes ou imagens externas. Não há service worker nesta etapa. A versão em `public/version.json` é verificada pela rede a cada 60 segundos, ao retornar ao aplicativo e ao reconectar. Quando houver nova versão, o aplicativo recarrega após 15 segundos sem interação, somente com a página visível, sem modal/campo ativo ou chamada não salva. Incrementar `build` a cada publicação. Os dados locais são preservados.

## Próximas etapas para produção

1. Validar a experiência no celular com o responsável.
2. Inventariar esquema, funções e políticas do Supabase atual em leitura. Exportar backup e definir preservação dos IDs.
3. Implementar autenticação real e autorização no servidor: pastor e secretário em todos os departamentos; líder em até dois; multiplicador somente nos contatos atribuídos. Separar perfil de acesso e vínculo ministerial.
4. Usar consultas paginadas e indexadas por departamento, presença normalizada por pessoa/encontro e auditoria por alteração.
5. Implementar fila de alterações no IndexedDB com confirmação do servidor, repetição idempotente e conflito explícito. Realtime avisa; uma consulta autenticada confirma o dado.
6. Testar reconexão, dois aparelhos editando, permissões, atualização com edição pendente e restauração do backup em ambiente de teste.
7. Executar migração ensaiada e conferir IDs, vínculos, contagens, chamadas e históricos. Só depois decidir a troca do domínio.

A hospedagem desta prévia não substitui a publicação atual de multiplicaplus.com.br. Credenciais e dados reais nunca devem ser adicionados ao código ou ao banco demonstrativo.
