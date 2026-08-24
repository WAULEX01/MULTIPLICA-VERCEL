# Validação da v6.9.8 — Hotfix R2

## Regra da nova geração

A geração `hostinger-master-v698-20260815` separa definitivamente os dados locais antigos do estado canônico atual. Antes da primeira leitura local, a aplicação remove banco, filas e marcadores de sincronização de versões anteriores. A sessão é preservada.

A geração só se torna ativa quando a API retorna simultaneamente:

- `appVersion: v6.9.8`;
- `schemaVersion: 8`;
- `dataGeneration: hostinger-master-v698-20260815`;
- arrays completos de pessoas e presenças.

Até essa confirmação, o aplicativo permanece bloqueado e não permite alterações locais.

## Proteção da API

As gravações protegidas exigem estes cabeçalhos:

- `X-Client-Version: v6.9.8`;
- `X-Data-Generation: hostinger-master-v698-20260815`;
- `X-Device-Id: <identificador estável do aparelho>`.

Uma versão ou geração diferente recebe HTTP 409 com o código `CLIENT_GENERATION_MISMATCH`. Leituras permanecem disponíveis para permitir a atualização dos clientes antigos.

## Fila offline

Cada operação criada depois da ativação recebe versão, geração e identificador do aparelho. Operações de outra geração são ignoradas. Ao reconectar, o cliente envia a fila em lotes e faz um pull posterior para assumir novamente o estado canônico da Hostinger.

O hotfix R2 não bloqueia novamente as telas de um aparelho cuja geração já foi confirmada. Esse aparelho abre com a última cópia oficial e processa o pull e a fila em segundo plano. O bloqueio integral permanece apenas no primeiro acesso absoluto à geração v6.9.8.

Toda alteração explícita utiliza o fluxo queue-first: primeiro salva localmente e registra a operação na Outbox; depois envia ao MySQL; somente o ACK correspondente remove a operação. Se o mesmo registro for editado novamente durante o envio, o ACK antigo não remove a edição mais nova.

## Cerca transacional de revisão

O `get_data` usa uma transação `REPEATABLE READ`. A revisão global é lida antes das tabelas e passa a identificar exatamente aquele snapshot. Ela não é consultada novamente depois da leitura dos dados.

Isso elimina a corrida em que o aparelho B podia receber os dados anteriores marcados com a revisão nova e, nos pollings seguintes, receber apenas `304 Not Modified`.

Proteções adicionais:

- `304` somente quando a revisão do aparelho é exatamente igual à do servidor;
- revisão local maior que a do servidor força snapshot completo;
- cache PHP aceito somente quando `cache.server_revision === snapshotRevision`;
- cache do Hotfix R2 usa namespace novo;
- `dbRef` é atualizado imediatamente após o pull remoto.

## Redução de contenção no MySQL

As dezenas de instruções `CREATE/ALTER TABLE` não são mais executadas em toda chamada de polling. O backend consulta o marcador `mp_schema_version`; somente quando necessário, um único worker obtém um lock MySQL, executa as migrações e registra o schema 8. Isso reduz PHP workers ocupados e contenção de metadados.

## Recuperação administrativa

O Pastor Admin recebe no painel as contagens de arquivados e excluídos. Na tela de membros, “Excluídos / Lixeira” ignora a categoria anterior e apresenta todos os registros excluídos do sistema, inclusive os que estavam arquivados ou vinculados a outro departamento. O cadastro pode ser restaurado e transferido sem exclusão física.

## Evidências automatizadas

- descarte do cache e das filas antigas sem remover a sessão;
- banco vazio antes do primeiro snapshot;
- ativação somente após resposta válida do servidor;
- fila marcada com versão, geração e aparelho;
- rejeição de filas pertencentes a versões anteriores;
- bloqueio de gravações antigas no `api.php`;
- versão v6.9.8 com cache Hotfix R2 no service worker e na interface;
- snapshot transacional, igualdade estrita de revisão e validação do cache;
- migração de schema executada apenas quando necessária;
- 64 testes aprovados, TypeScript aprovado e build de produção aprovado.

## Aceite manual

1. Publicar primeiro os arquivos estáticos e publicar `api.php` por último.
2. Abrir dois aparelhos com internet e confirmar a mesma revisão.
3. Validar uma alteração online do aparelho A no aparelho B.
4. No aparelho A offline, registrar presença e cadastrar uma pessoa.
5. Reconectar e confirmar que os dois registros chegaram à Hostinger e ao aparelho B.
6. Confirmar que uma versão antiga consegue ler, mas não consegue gravar.
7. Fazer uma edição enquanto o outro aparelho está consultando e confirmar que o próximo polling sempre converge.
