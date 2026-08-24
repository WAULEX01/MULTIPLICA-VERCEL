const fs = require('fs');

const bundlePath = 'dist/static/index-D26gJLRo-1786773094000.js';
let bundle = fs.readFileSync(bundlePath, 'utf8');

function replaceExact(from, to, expectedCount) {
  const count = bundle.split(from).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Esperado ${expectedCount}, encontrado ${count}: ${from.slice(0, 100)}`);
  }
  bundle = bundle.split(from).join(to);
}

replaceExact('v6.9.5', 'v6.9.6', 5);

// Online sem uma fila real: o snapshot da Hostinger substitui o cache. A
// antiga flag booleana nunca mais autoriza merge do banco local inteiro.
replaceExact(
  'let e=localStorage.getItem(`pm_pending_sync`)===`true`||be().length>0?I(ve(i,i,n,pe)):I(n);t(e),le(e),r.current=0',
  'let e=be().length>0?i:n;t(e),le(e),r.current=0',
  1,
);

// Depois de enviar a fila real, encerra este ciclo. O polling seguinte baixa
// o snapshot canônico. O código legado de merge/push total fica inacessível.
replaceExact(
  't||Se()}let r=await Te(R>0?R:void 0);',
  'if(t)return;Se(),localStorage.removeItem(`pm_pending_sync`),j(!1);return}localStorage.removeItem(`pm_pending_sync`),j(!1);return;let r=await Te(R>0?R:void 0);',
  1,
);

// Download manual também precisa aplicar exatamente o banco da Hostinger.
replaceExact(
  '},o=I(r);t(o),le(o),Se(),localStorage.removeItem(`pm_pending_sync`)',
  '},o=r;t(o),le(o),Se(),localStorage.removeItem(`pm_pending_sync`)',
  1,
);

fs.writeFileSync(bundlePath, bundle);
console.log(`Bundle v6.9.6 corrigido: ${bundlePath}`);
