#!/usr/bin/env node
/**
 * Script de Consolidação de Backups — Multiplica Plus
 * 
 * Uso: node scripts/consolidar-backups.js <pasta-com-jsons> <arquivo-saida>
 * 
 * Exemplo: node scripts/consolidar-backups.js ./backups ./backup-consolidado.json
 * 
 * O script:
 * 1. Lê todos os arquivos .json da pasta informada
 * 2. Extrai as chamadas (attendances) de cada arquivo
 * 3. Remove duplicatas (mesmo ID)
 * 4. Mantém a versão mais recente de cada chamada
 * 5. Gera um arquivo JSON consolidado pronto para importar
 */

const fs = require('fs');
const path = require('path');

function main() {
  const inputDir = process.argv[2];
  const outputFile = process.argv[3];

  if (!inputDir || !outputFile) {
    console.log('Uso: node scripts/consolidar-backups.js <pasta-com-jsons> <arquivo-saida>');
    console.log('Exemplo: node scripts/consolidar-backups.js ./backups ./backup-consolidado.json');
    process.exit(1);
  }

  // Lista todos os arquivos .json da pasta
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log(`❌ Nenhum arquivo .json encontrado em: ${inputDir}`);
    process.exit(1);
  }

  console.log(`📁 Lendo ${files.length} arquivo(s) de backup...`);

  // Mapa para consolidar chamadas por ID (mantém a versão mais recente)
  const attendancesMap = new Map();
  const peopleMap = new Map();
  const departmentsMap = new Map();
  let baseDB = null;

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.log(`⚠️  Arquivo inválido (ignorado): ${file}`);
      continue;
    }

    console.log(`  ✓ Processando: ${file}`);

    // Usa o primeiro arquivo como base (para departments, people, etc.)
    if (!baseDB) {
      baseDB = data;
    }

    // Consolida attendances (chamadas) — mantém a versão mais recente
    if (data.attendances && Array.isArray(data.attendances)) {
      for (const att of data.attendances) {
        const id = att.id;
        if (!id) continue;
        
        const existing = attendancesMap.get(id);
        if (!existing) {
          attendancesMap.set(id, att);
        } else {
          // Mantém a versão mais recente
          const vExisting = existing.version || 0;
          const vNew = att.version || 0;
          if (vNew > vExisting) {
            attendancesMap.set(id, att);
          }
        }
      }
    }

    // Consolida people (membros) — mantém a versão mais recente
    if (data.people && Array.isArray(data.people)) {
      for (const p of data.people) {
        const id = p.id;
        if (!id) continue;
        
        const existing = peopleMap.get(id);
        if (!existing) {
          peopleMap.set(id, p);
        } else {
          const vExisting = existing.version || 0;
          const vNew = p.version || 0;
          if (vNew > vExisting) {
            peopleMap.set(id, p);
          }
        }
      }
    }

    // Consolida departments
    if (data.departments && Array.isArray(data.departments)) {
      for (const d of data.departments) {
        const id = d.id;
        if (!id) continue;
        departmentsMap.set(id, d);
      }
    }
  }

  // Monta o banco consolidado
  const consolidated = {
    ...baseDB,
    attendances: Array.from(attendancesMap.values()),
    people: Array.from(peopleMap.values()),
    departments: Array.from(departmentsMap.values()),
  };

  // Estatísticas
  console.log('');
  console.log('📊 RESUMO DA CONSOLIDAÇÃO:');
  console.log(`  Arquivos processados: ${files.length}`);
  console.log(`  Chamadas (attendances): ${consolidated.attendances.length}`);
  console.log(`  Membros (people): ${consolidated.people.length}`);
  console.log(`  Departamentos: ${consolidated.departments.length}`);
  console.log('');

  // Salva o arquivo consolidado
  fs.writeFileSync(outputFile, JSON.stringify(consolidated, null, 2), 'utf-8');
  console.log(`✅ Backup consolidado salvo em: ${outputFile}`);
  console.log('');
  console.log('📋 PRÓXIMOS PASSOS:');
  console.log('  1. Abra o app no aparelho do admin');
  console.log('  2. Vá em Configurações → Importar Backup');
  console.log('  3. Selecione o arquivo consolidado');
  console.log('  4. Vá em Configurações → Sincronizar agora (force push)');
  console.log('  5. Verifique nos outros aparelhos se as chamadas apareceram');
}

main();
