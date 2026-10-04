import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export const localRoot = fileURLToPath(new URL('../local/', import.meta.url));
export const runner = fileURLToPath(new URL('../local/server/lib/code_runner.py', import.meta.url));
let selected;
export function pythonCommand() {
  if (selected) return selected;
  const candidates = process.env.PYTHON_BIN
    ? [[process.env.PYTHON_BIN, []]]
    : [['python3', []], ['py', ['-3']], ['python', []]];
  for (const [command,args] of candidates) {
    const probe=spawnSync(command,[...args,'-I','-S','-c','import sys, sqlite3; assert sys.version_info >= (3, 11)'],{windowsHide:true,timeout:10000,encoding:'utf8'});
    if (!probe.error && probe.status === 0) return selected={command,args};
  }
  throw new Error('Python 3.11+ with SQLite is required for curriculum verification. Set PYTHON_BIN to the executable, or install python3, py or python.');
}

export function runReference(input) {
  const {command,args}=pythonCommand();
  return spawnSync(command,[...args,'-I','-S',runner],{
    input:JSON.stringify(input),encoding:'utf8',windowsHide:true,timeout:6000,maxBuffer:2e6,
  });
}
