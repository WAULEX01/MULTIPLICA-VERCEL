# Aderência do prompt de arquitetura ao Multiplica PLUS

## Veredito

O prompt é tecnicamente forte e faz sentido como direção arquitetural. Ele não deve ser executado literalmente no projeto atual. O Multiplica PLUS deve preservar React, TypeScript, Vite, PWA, PHP 8, MySQL e Hostinger, evoluindo a sincronização de forma incremental.

## Aplicável agora

- MySQL da Hostinger como fonte oficial;
- cópia local operacional e funcionamento offline;
- Outbox persistente antes de qualquer tentativa de rede;
- push das pendências antes do pull;
- remoção da fila somente após ACK;
- identificador persistente do aparelho;
- controle para impedir push/pull concorrentes;
- batch por tipo de entidade;
- timeout, retry, backoff e jitter;
- soft delete, restauração e auditoria;
- versão do aplicativo e bloqueio de clientes antigos;
- interface otimista sem bloquear um aparelho já ativado;
- testes de reabertura, internet instável e dois aparelhos.

## Deve ser adaptado

| Orientação do prompt | Aplicação correta no Multiplica PLUS |
| --- | --- |
| IndexedDB/Dexie obrigatório | Migração futura e controlada; o hotfix mantém `localStorage` para não arriscar dados. |
| WebSocket/Supabase Realtime/SSE | Não entra nesta versão. O projeto mantém polling com revisão global e pull pós-push. |
| Delta sync completo por cursor | Evolução futura. Hoje a revisão global evita downloads quando nada mudou; quando mudou, o snapshot canônico é reaplicado. |
| RLS/Supabase Auth | Não se aplica à stack atual. A autorização equivalente precisa evoluir no backend PHP. |
| Migração total em 14 fases | Deve virar uma sequência de releases pequenos, testados e reversíveis. |

## Lacunas reais para uma próxima fase

1. Transferir a chave compartilhada do frontend para autenticação individual com sessão/token e autorização por perfil no PHP.
2. Centralizar ainda mais o SyncEngine e remover acessos diretos residuais à API em componentes.
3. Adicionar `operation_id` idempotente aos endpoints delta, usando a tabela de operações já existente.
4. Criar change log/cursor para baixar apenas registros alterados quando o volume justificar.
5. Migrar o banco local para IndexedDB somente depois de exportar e validar toda Outbox pendente.
6. Extrair definitivamente as migrações de schema para um processo de deploy. O Hotfix R2 já elimina a repetição por polling usando marcador de versão e lock, mas ainda mantém a rotina de primeira instalação no `api.php`.

## Decisão desta versão

O Hotfix R2 mantém Outbox queue-first, ACK seletivo, pull canônico, preservação de edição concorrente, soft delete administrativo e sincronização visual discreta. Também aplica uma cerca transacional entre revisão e snapshot, valida o cache por revisão e impede migrações repetidas durante o polling. Não realiza reescrita de stack nem adiciona Realtime nesta etapa.
