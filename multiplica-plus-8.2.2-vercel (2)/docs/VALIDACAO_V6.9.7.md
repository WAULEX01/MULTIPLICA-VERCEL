# Multiplica PLUS v6.9.7-r4 — bootstrap pelo banco master

## Objetivo

Quando a 6.9.7 for publicada, todos os aparelhos online devem perceber a nova versão, instalar os arquivos novos e executar uma única reconciliação completa de seu cache com a Hostinger. Depois disso, voltam ao fluxo normal com o MySQL da Hostinger como fonte master.

## Fluxo no primeiro acesso à 6.9.7

1. O cliente antigo consulta `get_data`.
2. Como não se identifica como 6.9.7, a API não permite resposta 304 e devolve a versão completa.
3. O cliente inicia baixando o snapshot master, que já informa `appVersion=v6.9.7-r4`.
4. A tela “Atualização segura v6.9.7-r4” bloqueia o uso normal durante a conferência.
5. O aparelho preserva um checkpoint local e envia seu snapshot completo, fila offline e última sincronização para `reconcile_cache`.
6. A Hostinger analisa IDs, versões, datas e a fila real usando apenas dez consultas de banco — uma por entidade.
7. Contatos, chamadas e demais itens com prova de alteração local são aprovados e enviados pelos endpoints normais.
8. O aplicativo envia somente candidatos comprovadamente locais em lotes de até 40, baixa outro snapshot integral do MySQL, substitui o cache e grava `pm_last_migrated_version=v6.9.7-r4`.
9. Essa reconciliação completa não roda novamente nesse aparelho enquanto a marca permanecer.
10. A partir daí, o funcionamento volta ao normal: fila offline, push pontual, confirmação MySQL e polling por revisão.

## Proteções contra perda ou duplicação

- Um registro existente somente no cache não é enviado apenas por existir.
- É exigida prova de alteração: item na fila offline ou atualização posterior à última confirmação da Hostinger com autor identificado.
- A flag antiga `pm_pending_sync` sozinha não autoriza envio do banco completo.
- O checkpoint anterior à atualização permanece em `pm_pre_update_checkpoint` para diagnóstico.
- Após aprovação e envio, o snapshot MySQL sempre substitui o cache.
- Os outros aparelhos recebem a revisão aumentada e baixam o mesmo resultado.

## Entidades analisadas

- Pessoas
- Departamentos
- Chamadas/presenças
- Metas
- Ações pastorais
- Missões semanais e especiais
- Histórico de mensagens
- Agenda/eventos
- Auditoria

## Publicação

1. Faça backup do MySQL na Hostinger.
2. Envie todo o conteúdo interno da pasta `dist`.
3. Não misture a pasta `static` com arquivos antigos.
4. Confirme que `api.php`, `sw.js`, `index.html` e a nova pasta `static` foram substituídos.
5. Não é necessário orientar cada usuário a limpar cache: a atualização é detectada pelo próprio sistema quando o aparelho entrar online.

## Teste de aceite

1. Deixe um aparelho na versão 6.9.6 e publique a 6.9.7.
2. Abra o aparelho e confirme a tela de atualização automática.
3. Confirme que a tela informa a análise do cache com a Hostinger.
4. Ao terminar, confira `v6.9.7-r4`, a revisão e a contagem de ativos.
5. Feche e abra novamente: a reconciliação completa não deve repetir; apenas a sincronização normal deve ocorrer.
6. Em outro aparelho, crie uma chamada offline antes de atualizar; reconecte e confirme que ela é recuperada.
7. Crie um contato offline em outro aparelho, atualize e confira o mesmo contato nos demais.
8. Compare a alteração de batismo em dois aparelhos.

## Validações executadas na construção

- TypeScript sem erros.
- Build real de produção concluído pelo Vite.
- Sintaxe do JavaScript e PHP validada.
- 46 testes automatizados aprovados.
- Casos cobertos: execução única, dois registros locais antigos, contato local novo, chamada offline, payload mais recente, identificação obrigatória do cliente, bloqueio de 304 para versão antiga e ativação do service worker.
