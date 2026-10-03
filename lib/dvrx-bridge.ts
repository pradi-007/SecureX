import { execFile } from 'child_process';
import path from 'path';

export async function runDvrxBridge<T = any>(command: string, payload: Record<string, any> = {}): Promise<T> {
  const venvPython = path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe');
  const fallbackPython = 'python';

  return new Promise((resolve, reject) => {
    const pythonExe = venvPython;
    const args = ['-m', 'dvrx.web_api', command, JSON.stringify(payload)];

    execFile(pythonExe, args, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) {
        // Try fallback to python on path if venv exe not found
        execFile(fallbackPython, args, { cwd: process.cwd() }, (fallbackErr, fallbackStdout) => {
          if (fallbackErr) {
            reject(new Error(`DVRX Python bridge error: ${fallbackErr.message}\n${stderr}`));
            return;
          }
          try {
            resolve(JSON.parse(fallbackStdout));
          } catch (pe) {
            reject(new Error(`Failed to parse bridge output: ${fallbackStdout}`));
          }
        });
        return;
      }

      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (parseError) {
        reject(new Error(`Failed to parse bridge output: ${stdout}\nStderr: ${stderr}`));
      }
    });
  });
}
