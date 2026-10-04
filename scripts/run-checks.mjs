import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2]||'backend';
const scripts=mode==='backend'
  ? ['check-static.mjs','check-access.mjs','check-creator.mjs']
  : mode==='browser'
    ? ['check-creator-browser.cjs','check-cloud.cjs','check-review.cjs','check-studio.cjs']
    : null;
if(!scripts) throw new Error('Expected backend or browser.');
for(const script of scripts) {
  console.log('\nRunning '+script);
  const result=spawnSync(process.execPath,['scripts/'+script],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
  if(result.error) throw result.error;
  if(result.status!==0) process.exit(result.status||1);
}
