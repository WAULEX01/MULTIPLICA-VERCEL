# Multiplica PLUS v6.9.2 — correção de sincronização e mobile

## Resultado

Esta revisão mantém a arquitetura da Hostinger com `api.php` e MySQL. Nenhuma tabela de membros é apagada e nenhuma carga de demonstração substitui os dados reais.

## Correções de sincronização

- O polling passou a ser idempotente: receber novamente o mesmo contato do MySQL não aumenta sua versão local.
- Uma atualização verdadeira, com versão maior, passa a vencer no outro aparelho.
- Quando o aparelho não possui trabalho offline pendente, o snapshot do MySQL é a fonte de verdade e substitui o estado local. Isso recupera aparelhos que já tinham versões locais antigas artificialmente altas.
- Quando existe uma edição offline na fila, o merge local continua ativo até o envio terminar, protegendo a alteração ainda não sincronizada.
- A fila de reenvio identifica o tipo que falhou (`people`, `attendances`, etc.) em vez de guardar somente a mensagem HTTP.
- Um envio pendente solicita um snapshot completo antes do merge; uma resposta `304` não é mais tratada como banco vazio.
- Todas as gravações relevantes no `api.php` atualizam `global_revision` dentro da mesma transação MySQL.
- O cache curto do `get_data` é invalidado depois do `commit`, evitando resposta antiga logo após salvar.
- O Service Worker continua ignorando `api.php` e recebeu o cache `sync-mobile-r2` para ativar a versão corrigida.

## Correções mobile

- Containers, cards, formulários, grids, modais, tabelas e calendário permanecem dentro da largura da tela.
- Tabelas e calendário usam rolagem interna quando necessário, sem deslocar a página inteira.
- Na página Membros, o card usa três áreas fixas no celular: avatar, nome/dados e ações.
- O nome permanece alinhado à esquerda e pode ocupar até duas linhas.
- O WhatsApp permanece alinhado à direita, independentemente do tamanho do nome.
- Foram previstas larguras de 360, 380, 600, 768 e 968 px, além do desktop.

## Como publicar na Hostinger

1. Faça um backup do banco no próprio sistema e uma cópia da pasta atualmente publicada.
2. No computador, abra a pasta `codigo-fonte` e execute `npm install`.
3. Execute `npm run build` se tiver feito qualquer alteração adicional no código-fonte.
4. Envie **o conteúdo interno da pasta `dist`** para a pasta pública do domínio na Hostinger.
5. Confirme que o novo `api.php` e o novo `sw.js` também foram enviados.
6. No primeiro acesso, feche e abra novamente o PWA ou atualize a página para ativar o novo Service Worker.

É importante substituir todos os arquivos da pasta pública, especialmente o bundle em `static`, `api.php` e `sw.js`. Publicar somente parte da pasta mantém o comportamento antigo em alguns aparelhos.

O pacote entregue já contém uma pasta `dist` preparada com estas correções.

## Teste prático em dois aparelhos

1. Abra Membros no aparelho A e altere o telefone de uma pessoa de teste.
2. Aguarde a indicação de sincronização terminar.
3. Abra ou volte para o aplicativo no aparelho B.
4. Em até um ciclo de sincronização, o telefone atualizado deve aparecer.
5. Atualize novamente no aparelho B e confirme o retorno no aparelho A.
6. Desligue a internet, altere um contato, religue a internet e confirme o reenvio automático.

Não faça o teste simultâneo sobre um cadastro real sem antes anotar o telefone correto.

## Validações incluídas

- TypeScript sem erros.
- Cenário de polling repetido sem inflação de versão.
- Cenário de contato atualizado chegando ao segundo aparelho.
- Cenário legado em que o aparelho tinha versão local 99 e o MySQL versão 4: sem fila offline, o dado correto do MySQL vence.
- Cenário offline pendente: a edição local continua protegida até o reenvio.
- União de presenças concorrentes preservada.
- Roteamento de falha de contato para a fila `people`.
- Bundle JavaScript validado sintaticamente.
- CSS de produção analisado e válido.
