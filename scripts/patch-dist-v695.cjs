const fs = require('fs');

const bundlePath = 'dist/static/index-D26gJLRo-1786773094000.js';
let bundle = fs.readFileSync(bundlePath, 'utf8');

function replaceExact(from, to, expectedCount) {
  const count = bundle.split(from).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Esperado ${expectedCount} ocorrência(s), encontrado ${count}: ${from.slice(0, 80)}`);
  }
  bundle = bundle.split(from).join(to);
}

replaceExact('v6.9.3', 'v6.9.5', 4);
replaceExact('timEstamp', 'timestamp', 4);

replaceExact(
  'function xe(e,t,n){let r=be();r.some(n=>n.type===e&&n.itemId===t)||(r.push({id:ye(),type:e,itemId:t,data:n,timestamp:new Date().toISOString()}),localStorage.setItem(`pm_sync_queue`,JSON.stringify(r)))}',
  'function xe(e,t,n){let r=be(),i=r.findIndex(n=>n.type===e&&n.itemId===t),a={id:i>=0?r[i].id:ye(),type:e,itemId:t,data:n,timestamp:new Date().toISOString()};i>=0?r[i]=a:r.push(a),localStorage.setItem(`pm_sync_queue`,JSON.stringify(r))}',
  1,
);

const entities = ['people', 'attendances', 'departments', 'pastoralLogs', 'weeklyMissions', 'specialMissions', 'messageHistory', 'events', 'activityLogs'];
for (const entity of entities) {
  replaceExact(
    `s.${entity}.filter(e=>(o?.${entity}||[]).some(t=>t.id===e.id&&JSON.stringify(t)!==JSON.stringify(e)))`,
    `s.${entity}.filter(e=>{let t=(o?.${entity}||[]).find(t=>t.id===e.id);return!t||JSON.stringify(t)!==JSON.stringify(e)})`,
    3,
  );
}
replaceExact(
  's.goals.filter(e=>(o?.goals||[]).some(t=>t.month===e.month&&JSON.stringify(t)!==JSON.stringify(e)))',
  's.goals.filter(e=>{let t=(o?.goals||[]).find(t=>t.month===e.month);return!t||JSON.stringify(t)!==JSON.stringify(e)})',
  3,
);

const oldAttendance = 'Oe=t=>{if(!e)return;let r=e.attendances||[],i=t.length,a=r.length,o=t.map(e=>{let t=r.find(t=>t.id===e.id);return!t||JSON.stringify(t)!==JSON.stringify(e)?{...e,version:(t?.version||0)+1,updatedAt:new Date().toISOString(),updatedBy:n?.personId||`unknown`}:e});if(i!==a&&n){let t=i-a;T({...e,attendances:o},!0,!1,t>0?`Registrou ${t} nova(s) chamada(s)`:`Removeu ${Math.abs(t)} chamada(s)`)}else T({...e,attendances:o})}';
const newAttendance = 'Oe=t=>{if(!e)return;let r=e.attendances||[],i=t.map(e=>{let t=r.find(t=>t.id===e.id);return!t||JSON.stringify(t)!==JSON.stringify(e)?{...e,version:(t?.version||0)+1,updatedAt:new Date().toISOString(),updatedBy:n?.personId||`unknown`}:e}),a=i.filter(e=>{let t=r.find(t=>t.id===e.id);return!t||JSON.stringify(t)!==JSON.stringify(e)}),o=[...e.activityLogs||[]];n&&a.forEach(e=>{let t=`audit-attendance-${e.id}`,r=o.find(e=>e.id===t),a=new Date().toISOString(),s=String(e.date||``).split(`-`),c=s.length===3?`${s[2]}/${s[1]}/${s[0]}`:e.date,l=e.deleted?`Excluiu chamada — ${e.department} — ${c}`:`Atualizou chamada — ${e.department} — ${c}`;o=[{id:t,recordedBy:n.code,recordedByName:n.name,action:l,details:e.deleted?`${e.type||`Culto`} • chamada removida`:`${e.type||`Culto`} • ${(e.presentIds||[]).length} presentes`,timestamp:a,version:(r?.version||0)+1,updatedAt:a,updatedBy:n.personId||n.code},...o.filter(e=>e.id!==t)]}),T({...e,attendances:i,activityLogs:o},!1)}';
replaceExact(oldAttendance, newAttendance, 1);

replaceExact(
  'ze=async()=>{if(e&&window.confirm(`Atenção:',
  'ze=async()=>{alert(`Na v6.9.5, somente a fila offline é enviada para a Hostinger; o MySQL é a fonte master.`);return;if(e&&window.confirm(`Atenção:',
  1,
);
replaceExact('Forçar Envio (Push)', 'Sincronizar Pendências', 1);
replaceExact('Forçar Envio (Local → Hostinger)', 'Sincronizar Pendências (Fila → Hostinger)', 1);

fs.writeFileSync(bundlePath, bundle);
console.log(`Bundle v6.9.5 corrigido: ${bundlePath}`);
