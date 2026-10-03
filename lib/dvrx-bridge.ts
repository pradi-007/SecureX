import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

function findLastJson(output: string): any {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // If output has log prefixes or warnings, scan lines backwards for the valid JSON payload
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean).reverse();
    for (const line of lines) {
      try {
        return JSON.parse(line);
      } catch {
        continue;
      }
    }
    throw new Error(`Failed to extract JSON from output: ${output}`);
  }
}

export async function runDvrxBridge<T = any>(command: string, payload: Record<string, any> = {}): Promise<T> {
  const isWindows = process.platform === 'win32';
  const venvPythonWin = path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe');
  const venvPythonPosix = path.resolve(process.cwd(), '.venv', 'bin', 'python');

  let pythonExe = isWindows ? venvPythonWin : venvPythonPosix;
  if (!fs.existsSync(pythonExe)) {
    pythonExe = isWindows ? 'py' : 'python3';
  }

  const args = pythonExe === 'py'
    ? ['-3.13', '-m', 'dvrx.web_api', command, JSON.stringify(payload)]
    : ['-m', 'dvrx.web_api', command, JSON.stringify(payload)];

  return new Promise((resolve, reject) => {
    execFile(pythonExe, args, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) {
        // Fallback to 'python' on system PATH
        execFile('python', ['-m', 'dvrx.web_api', command, JSON.stringify(payload)], { cwd: process.cwd() }, (fallbackErr, fallbackStdout) => {
          if (fallbackErr) {
            reject(new Error(`DVRX Python bridge execution error: ${fallbackErr.message}\nStderr: ${stderr}`));
            return;
          }
          try {
            resolve(findLastJson(fallbackStdout));
          } catch (pe: any) {
            reject(new Error(`Failed to parse bridge output: ${fallbackStdout}\nError: ${pe.message}`));
          }
        });
        return;
      }

      try {
        const data = findLastJson(stdout);
        resolve(data);
      } catch (parseError: any) {
        reject(new Error(`Failed to parse bridge output: ${stdout}\nStderr: ${stderr}\nError: ${parseError.message}`));
      }
    });
  });
}
