import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const SSH_USER = 'u753364261';
const SSH_HOST = '147.93.14.27';
const SSH_PORT = '65002';
const REMOTE_PATH = 'domains/multiplicaplus.com.br/public_html';
const KEY_PATH = 'C:/Users/Lenovo/.ssh/id_ed25519';

console.log('🚀 Iniciando build da aplicação...');
execSync('npm run build', { stdio: 'inherit' });

// ────────────────────────────────────────────────────────────
// Deploy direto (sem zip): envia os arquivos do build já extraídos
// via SFTP para a pasta do site. Não cria dist.tar.gz e não depende
// de shell remoto (sem comando `tar`/`rm` no servidor).
// ────────────────────────────────────────────────────────────
console.log('\n📦 Enviando arquivos do build (dist) diretamente para a Hostinger via SFTP (sem zip)...');
const distPath = path.resolve('dist').replace(/\\/g, '/');
const batchPath = path.resolve('deploy_batch.txt');

// Lista o conteúdo do dist e gera um comando `put -r` para cada item,
// copiando tudo direto para a raiz do public_html.
const entries = fs.readdirSync(distPath);
console.log(' Itens a enviar:', entries.join(', '));

// Limpa as pastas assets/ e static/ remotas via SSH antes do upload.
// assets/ estava bloqueada pela Hostinger (404), então migramos para static/.
// Removemos ambas para garantir estado limpo.
const sshRmCmd = `ssh -p ${SSH_PORT} -i "${KEY_PATH}" -o StrictHostKeyChecking=accept-new ${SSH_USER}@${SSH_HOST} "rm -rf ${REMOTE_PATH}/assets ${REMOTE_PATH}/static"`;
console.log(' Limpando assets/ e static/ remotos via SSH...');
execSync(sshRmCmd, { stdio: 'inherit' });

const batch = [
  `cd ${REMOTE_PATH}`,
  ...entries.map(e => `put -r "${distPath}/${e}" .`),
  'bye'
].join('\n');

fs.writeFileSync(batchPath, batch, 'utf8');
try {
  execSync(
    `sftp -b "${batchPath}" -P ${SSH_PORT} -i "${KEY_PATH}" -o StrictHostKeyChecking=accept-new ${SSH_USER}@${SSH_HOST}`,
    { stdio: 'inherit' }
  );
} finally {
  if (fs.existsSync(batchPath)) fs.unlinkSync(batchPath);
}

console.log('\n✅ Deploy realizado com sucesso para multiplicaplus.com.br! 🎉');
console.log('🌐 Acesse: https://multiplicaplus.com.br');
console.log('🔄 Limpe o cache do navegador (Ctrl+Shift+R)');
