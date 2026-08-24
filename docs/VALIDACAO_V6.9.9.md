# Validação da v6.9.9 — Delta Sync em 5 segundos

## Contrato

- MySQL/Hostinger é a fonte única da verdade.
- Push imediato contém somente o patch do registro.
- Pull em primeiro plano ocorre a cada 5 segundos por cursor de revisão.
- Snapshot integral ocorre apenas na ativação ou em `reset_required`.
- Outbox é persistente e só remove operações após ACK por UUID.
- Edições offline são reenviadas após a reconexão.

## Casos automatizados

- edição de batismo produz `{ baptized: true }` sem reenviar outros campos;
- presença produz `presentIdsAdd` e `presentIdsRemove`;
- delta substitui somente o registro indicado e preserva os demais;
- edição durante requisição em andamento recebe novo UUID;
- backend usa `operation_logs` para idempotência;
- backend usa `sync_change_index` e `mp_delta_baseline_revision`;
- polling normal usa `pull_changes` e intervalo de 5.000 ms;
- fila legada da geração atual é convertida sem descartar edição offline.

## Resultado local

Executar:

```bash
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --reporter=dot
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

Validação final deve ser repetida em dois aparelhos reais depois do deploy do
novo `api.php`, porque o ambiente local não acessa o MySQL de produção.
