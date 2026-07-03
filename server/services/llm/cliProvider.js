import { spawn } from 'child_process';

function runCommand({ command, args, stdin, env = {}, timeoutMs = 120000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`CLI timeout after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`CLI spawn failed (${command}): ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`CLI exited ${code}: ${stderr || stdout || command}`));
        return;
      }
      resolve(stdout.trim());
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

function buildCliEnv(config) {
  const extra = {};
  if (config.authToken) {
    if (config.authMode === 'codex') {
      extra.CODEX_API_KEY = config.authToken;
      extra.OPENAI_API_KEY = config.authToken;
    } else if (config.providerId === 'cli-claude') {
      extra.ANTHROPIC_API_KEY = config.authToken;
    } else if (config.providerId === 'cli-kimi') {
      extra.KIMI_API_KEY = config.authToken;
    }
  }
  return extra;
}

export async function callCliLlm(config, prompt) {
  const cliEnv = buildCliEnv(config);
  const timeoutMs = Number(process.env.LLM_CLI_TIMEOUT_MS || 120000);

  if (config.promptMode === 'stdin') {
    return runCommand({
      command: config.command,
      args: config.args,
      stdin: prompt,
      env: cliEnv,
      timeoutMs,
    });
  }

  // arg mode: append prompt as last argument
  const args = [...config.args, prompt];
  return runCommand({
    command: config.command,
    args,
    env: cliEnv,
    timeoutMs,
  });
}
