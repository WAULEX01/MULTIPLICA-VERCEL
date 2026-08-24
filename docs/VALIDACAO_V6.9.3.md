# Multiplica PLUS v6.9.3 — banco único entre aparelhos

## Fonte correta

O MySQL da Hostinger é a fonte de verdade. Um total exibido apenas no cache local não define qual banco está correto.

## Correções

- A versão visível foi alterada para `v6.9.3` no login, desktop, celular e API.
- O cabeçalho mostra a revisão MySQL recebida pelo aparelho.
- A tela Início e o Dashboard usam o mesmo critério: membro ativo é `status = Ativo` e não excluído. Visitantes não entram no cartão “Membros ativos”.
- A recuperação Hostinger → Local substitui o cache pelo snapshot do MySQL, sem mesclar registros locais antigos.
- Se houver alteração offline pendente, a substituição é bloqueada para evitar perda.
- O cache da API e o Service Worker receberam identificadores exclusivos da v6.9.3.

## Conferência em dois aparelhos

1. Confirme `v6.9.3` nos dois aparelhos.
2. Confirme que a revisão MySQL exibida é a mesma.
3. Abra a mesma tela e use o mesmo departamento (`GERAL`).
4. Em Configurações, execute Hostinger → Local em cada aparelho somente se não houver pendência.
5. Os dois aparelhos devem mostrar o mesmo total de membros ativos.

O total correto é calculado diretamente do snapshot do MySQL: pessoas com status `Ativo` e sem exclusão lógica.
