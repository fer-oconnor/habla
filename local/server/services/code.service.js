import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { badRequest, conflict } from '../lib/http-error.js';

const runner = fileURLToPath(new URL('../lib/code_runner.py', import.meta.url));
let running = 0;

function pythonExecutable() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const anaconda = path.join(os.homedir(), 'anaconda3', 'python.exe');
  if (process.platform === 'win32' && fs.existsSync(anaconda)) return anaconda;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export async function evaluateCode(exercise, code) {
  if (typeof code !== 'string' || code.length > 8000) {
    throw badRequest('Escribe un programa de hasta 8000 caracteres.');
  }
  if (running >= 2) throw conflict('Hay otras ejecuciones en marcha. Prueba de nuevo en un momento.');
  running += 1;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(pythonExecutable(), ['-I', '-S', runner], {
        windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
      let output = '', errors = '', settled = false;
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve(result);
      };
      const timer = setTimeout(() => {
        child.kill();
        finish({ correct: false, checks: [], error: 'Tiempo agotado. Revisa los bucles o simplifica la consulta.' });
      }, 4000);
      child.stdout.on('data', (chunk) => {
        output += chunk;
        if (output.length > 1024 * 1024) {
          child.kill();
          finish({ correct: false, checks: [], error: 'La salida es demasiado grande.' });
        }
      });
      child.stderr.on('data', (chunk) => { if (errors.length < 2000) errors += chunk; });
      child.on('error', () => finish(null, conflict('No se encuentra Python. Configura PYTHON_BIN en .env con la ruta de Python 3.')));
      child.stdin.on('error', () => {});
      child.on('close', () => {
        if (settled) return;
        try { finish(JSON.parse(output)); }
        catch { finish({ correct: false, checks: [], error: errors || 'No se pudo ejecutar el programa.' }); }
      });
      child.stdin.end(JSON.stringify({
        language: exercise.payload.language, payload: exercise.payload,
        code, reference: exercise.solution.value,
      }));
    });
  } finally { running -= 1; }
}
