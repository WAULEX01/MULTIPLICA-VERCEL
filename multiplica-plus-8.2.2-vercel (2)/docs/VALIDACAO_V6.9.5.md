# Validação e publicação — Multiplica PLUS v6.9.5

## O que mudou

- O MySQL da Hostinger é a fonte master quando existe internet.
- O cache local é usado para abrir o aplicativo e trabalhar temporariamente offline.
- Ao voltar a conexão, somente a fila de alterações pendentes é enviada; depois o aplicativo baixa o snapshot canônico do MySQL.
- Cadastros novos agora entram na fila (na versão anterior, o filtro capturava somente registros que já existiam).
- Uma nova edição do mesmo registro substitui o payload antigo da fila, evitando enviar um estado desatualizado.
- O servidor rejeita uma gravação de pessoa mais antiga que a versão já existente no MySQL.
- A tela mostra `v6.9.5`, a revisão MySQL e o horário da última sincronização.
- Auditoria de presença usa um resumo por chamada, em vez de uma linha para cada marcação individual.
- Datas da auditoria usam o campo `timestamp`, horário de Porto Velho e agrupamento Hoje/Ontem/Anteontem/data.

## Antes de publicar — obrigatório

Como os aparelhos atuais já apresentam contagens diferentes, não apague cache antes de preservar os dados.

1. Em cada aparelho divergente, abra Configurações e baixe o Backup JSON.
2. Nomeie os arquivos com o aparelho e a data, por exemplo `backup-celular-pastor-2026-08-15.json`.
3. Faça também um backup do banco MySQL no painel da Hostinger.
4. Compare os contatos exclusivos dos backups antes de decidir qual deve entrar no MySQL master.
5. Somente depois publique a v6.9.5.

## Publicação na Hostinger

Envie **todo o conteúdo interno da pasta `dist`** para a pasta pública do domínio. Inclua obrigatoriamente:

- `api.php`
- `sw.js`
- `index.html`
- `.htaccess`
- a pasta `static`
- imagens, manifesto e demais arquivos da pasta

Não envie `node_modules`. Não misture arquivos `static` de versões antigas.

## Teste de aceite com dois aparelhos

1. Abra os dois aparelhos com internet e confirme `v6.9.5`.
2. Aguarde até que ambos mostrem a mesma revisão MySQL.
3. Confirme a mesma quantidade de membros ativos.
4. No aparelho A, crie um contato de teste com nome identificável.
5. Aguarde alguns segundos e confirme o contato no aparelho B.
6. No aparelho B, altere o telefone do contato e confira a alteração no aparelho A.
7. Coloque o aparelho A offline, crie outro contato, volte a internet e confira nos dois aparelhos.
8. Registre uma chamada e confira a presença e um único resumo da chamada na auditoria.
9. Verifique o agrupamento Hoje/Ontem e o horário local na auditoria.

## Critério para escolher o banco correto

Depois da publicação, a contagem correta é a retornada pelo MySQL da Hostinger. Um aparelho pode conter um registro exclusivo ainda não enviado; por isso, os backups anteriores são necessários para recuperar e consolidar esses registros sem perda.

## Validações executadas no pacote

- Compilação TypeScript sem erros.
- Sintaxe do bundle JavaScript de produção validada.
- Teste de cadastro novo entrando na fila.
- Teste da edição mais recente substituindo a antiga na fila.
- Teste de snapshot MySQL substituindo cache sem pendência.
- Verificação de que `api.php` e `sw.js` da pasta `dist` correspondem à v6.9.5.

O ambiente de construção não dispõe do PHP CLI nem de acesso ao banco da Hostinger. Portanto, a sintaxe/execução PHP e o fluxo real entre dois aparelhos precisam ser confirmados no ambiente de hospedagem seguindo o teste de aceite acima.
