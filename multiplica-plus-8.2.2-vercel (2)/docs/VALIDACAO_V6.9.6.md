# Correção emergencial — Multiplica PLUS v6.9.6

## Diagnóstico confirmado em produção

Em 15/08/2026, a leitura direta do MySQL pela API publicada retornou:

- versão da API: `v6.9.5`;
- revisão MySQL: `13137`;
- 653 linhas na tabela de pessoas;
- 488 pessoas ativas e não excluídas;
- nenhum ID duplicado.

Portanto, a contagem 490 exibida por um aparelho não vinha do snapshot canônico do MySQL.

## Causa

O bundle de produção ainda possuía um caminho legado: a flag local `pm_pending_sync`, mesmo sem uma fila contendo as operações reais, autorizava a mesclagem do banco local inteiro com os dados da Hostinger. Isso permitia que registros existentes somente no aparelho continuassem na tela.

O segundo problema era o tratamento de conflito de versão. Uma edição válida, como alterar o batismo, podia chegar com uma versão menor que a existente no MySQL. O servidor descartava a alteração, mas a resposta HTTP continuava sendo interpretada como sucesso.

## Correção v6.9.6

- A flag booleana antiga não autoriza mais merge nem envio do banco local completo.
- Somente itens com payload real na fila offline podem ser enviados.
- Sem fila real, o snapshot do MySQL substitui integralmente a base exibida pelo aparelho.
- Depois de enviar a fila, o próximo ciclo baixa o snapshot canônico.
- O download manual aplica os dados puros do MySQL.
- Ao receber uma edição de pessoa, o servidor atribui uma versão monotônica acima da versão atual, evitando descarte silencioso.
- Novo cache do service worker: `multiplica-plus-v6.9.6-mysql-master-r1`.

## Publicação

1. Faça um backup do MySQL na Hostinger.
2. Envie todo o conteúdo interno de `dist`.
3. Não misture arquivos da pasta `static` com versões anteriores.
4. Abra `https://www.multiplicaplus.com.br/?version=696` nos aparelhos.
5. Confirme `v6.9.6` e a mesma revisão MySQL.

## Teste em dois aparelhos

1. Ambos devem inicialmente mostrar 488 ativos, se o MySQL não tiver sido alterado após o diagnóstico.
2. Escolha uma pessoa de teste e altere somente o batismo no aparelho A.
3. Aguarde até 10 segundos.
4. Confira o mesmo campo no aparelho B.
5. Crie um membro de teste no aparelho A e confirme o aumento da contagem nos dois aparelhos.
6. Edite o telefone no aparelho B e confira no aparelho A.

Não faça vários testes simultâneos no mesmo contato. Primeiro confirme cada operação nos dois aparelhos.
