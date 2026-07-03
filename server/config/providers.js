/**
 * LLM & TTAPI provider presets.
 * LLM_PROVIDER selects preset; per-provider keys override via env.
 */

export const TTAPI_DEFAULTS = {
  baseUrl: 'https://api.ttapi.io',
  musicPath: '/suno/v1/music',
  stemsAllPath: '/suno/v1/stems-all',
  fetchPath: '/suno/v2/fetch',
  modelVersion: 'chirp-v5',
};

export const LLM_PRESETS = {
  openai: {
    label: 'OpenAI (ChatGPT)',
    type: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    fallbackKeyEnv: 'LLM_API_KEY',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-latest',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    fallbackKeyEnv: 'LLM_API_KEY',
  },
  gemini: {
    label: 'Google Gemini',
    type: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    apiKeyEnv: 'GEMINI_API_KEY',
    fallbackKeyEnv: 'LLM_API_KEY',
  },
  deepseek: {
    label: 'DeepSeek',
    type: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    fallbackKeyEnv: 'LLM_API_KEY',
  },
  siliconflow: {
    label: '硅基流动 SiliconFlow',
    type: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    apiKeyEnv: 'SILICONFLOW_API_KEY',
    fallbackKeyEnv: 'LLM_API_KEY',
  },
  openrouter: {
    label: 'OpenRouter',
    type: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    fallbackKeyEnv: 'LLM_API_KEY',
    extraHeaders: {
      'HTTP-Referer': 'https://vibe-coding-sonic.local',
      'X-Title': 'Vibe Coding Sonic',
    },
  },
  custom: {
    label: '自定义 OpenAI 兼容',
    type: 'openai-compatible',
    baseUrlEnv: 'LLM_API_BASE',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModelEnv: 'LLM_MODEL',
    defaultModel: 'gpt-4o-mini',
    apiKeyEnv: 'LLM_API_KEY',
  },
  'cli-codex': {
    label: 'Codex CLI',
    type: 'cli',
    commandEnv: 'CODEX_CLI_PATH',
    defaultCommand: 'codex',
    argsEnv: 'CODEX_CLI_ARGS',
    defaultArgs: 'exec,-q',
    promptModeEnv: 'CODEX_CLI_PROMPT_MODE',
    defaultPromptMode: 'arg',
    authEnv: 'CODEX_API_KEY',
    authMode: 'codex',
  },
  'cli-gemini': {
    label: 'Gemini CLI',
    type: 'cli',
    commandEnv: 'GEMINI_CLI_PATH',
    defaultCommand: 'gemini',
    argsEnv: 'GEMINI_CLI_ARGS',
    defaultArgs: '',
    promptModeEnv: 'GEMINI_CLI_PROMPT_MODE',
    defaultPromptMode: 'arg',
  },
  'cli-claude': {
    label: 'Claude Code CLI',
    type: 'cli',
    commandEnv: 'CLAUDE_CLI_PATH',
    defaultCommand: 'claude',
    argsEnv: 'CLAUDE_CLI_ARGS',
    defaultArgs: '-p,--print',
    promptModeEnv: 'CLAUDE_CLI_PROMPT_MODE',
    defaultPromptMode: 'arg',
    authEnv: 'ANTHROPIC_API_KEY',
  },
  'cli-kimi': {
    label: 'Kimi CLI',
    type: 'cli',
    commandEnv: 'KIMI_CLI_PATH',
    defaultCommand: 'kimi',
    argsEnv: 'KIMI_CLI_ARGS',
    defaultArgs: '',
    promptModeEnv: 'KIMI_CLI_PROMPT_MODE',
    defaultPromptMode: 'arg',
    authEnv: 'KIMI_API_KEY',
  },
};

import { getSetting } from './runtimeConfig.js';

function env(key, fallback = '') {
  return getSetting(key, fallback);
}

function parseArgs(raw) {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function resolveLlmConfig() {
  const providerId = env('LLM_PROVIDER', 'openai');
  const preset = LLM_PRESETS[providerId];

  if (!preset) {
    return {
      providerId: 'none',
      label: '未配置',
      type: 'none',
      configured: false,
    };
  }

  if (preset.type === 'cli') {
    const command = env(preset.commandEnv, preset.defaultCommand);
    const args = parseArgs(env(preset.argsEnv, preset.defaultArgs));
    const promptMode = env(preset.promptModeEnv, preset.defaultPromptMode);
    const authToken = preset.authEnv ? env(preset.authEnv) : '';

    return {
      providerId,
      label: preset.label,
      type: 'cli',
      command,
      args,
      promptMode,
      authToken: Boolean(authToken),
      authMode: preset.authMode || null,
      configured: Boolean(command),
      model: env('LLM_MODEL', preset.defaultModel || ''),
    };
  }

  const baseUrl = preset.baseUrlEnv
    ? env(preset.baseUrlEnv, preset.defaultBaseUrl)
    : preset.baseUrl;
  const apiKey = env(preset.apiKeyEnv) || env(preset.fallbackKeyEnv);
  const model = env('LLM_MODEL', preset.defaultModel);

  return {
    providerId,
    label: preset.label,
    type: preset.type,
    baseUrl,
    model,
    apiKey: apiKey ? '***' : '',
    apiKeyPresent: Boolean(apiKey),
    extraHeaders: preset.extraHeaders || {},
    configured: Boolean(apiKey),
  };
}

export function resolveLlmRuntime() {
  const providerId = env('LLM_PROVIDER', '');
  const preset = LLM_PRESETS[providerId];

  if (!preset) {
    // Legacy: LLM_API_KEY without provider
    if (env('LLM_API_KEY')) {
      return {
        providerId: 'custom',
        label: '自定义 (legacy)',
        type: 'openai-compatible',
        baseUrl: env('LLM_API_BASE', 'https://api.openai.com/v1'),
        model: env('LLM_MODEL', 'gpt-4o-mini'),
        apiKey: env('LLM_API_KEY'),
        extraHeaders: {},
      };
    }
    return null;
  }

  if (preset.type === 'cli') {
    const command = env(preset.commandEnv, preset.defaultCommand);
    const args = parseArgs(env(preset.argsEnv, preset.defaultArgs));
    const promptMode = env(preset.promptModeEnv, preset.defaultPromptMode);
    return {
      providerId,
      label: preset.label,
      type: 'cli',
      command,
      args,
      promptMode,
      authToken: preset.authEnv ? env(preset.authEnv) : '',
      authMode: preset.authMode || null,
      model: env('LLM_MODEL', ''),
    };
  }

  const baseUrl = preset.baseUrlEnv
    ? env(preset.baseUrlEnv, preset.defaultBaseUrl)
    : preset.baseUrl;
  const apiKey = env(preset.apiKeyEnv) || env(preset.fallbackKeyEnv);
  if (!apiKey) return null;

  return {
    providerId,
    label: preset.label,
    type: preset.type,
    baseUrl,
    model: env('LLM_MODEL', preset.defaultModel),
    apiKey,
    extraHeaders: preset.extraHeaders || {},
  };
}

export function resolveTtapiConfig() {
  const apiKey = env('TTAPI_KEY') || env('SUNO_API_KEY');
  return {
    baseUrl: env('TTAPI_BASE_URL', TTAPI_DEFAULTS.baseUrl).replace(/\/$/, ''),
    apiKey: apiKey ? '***' : '',
    apiKeyPresent: Boolean(apiKey),
    modelVersion: env('TTAPI_SUNO_MV', TTAPI_DEFAULTS.modelVersion),
    configured: Boolean(apiKey) && env('USE_FALLBACK_ONLY') !== 'true',
  };
}

export function resolveTtapiRuntime() {
  const apiKey = env('TTAPI_KEY') || env('SUNO_API_KEY');
  if (!apiKey || env('USE_FALLBACK_ONLY') === 'true') return null;

  return {
    baseUrl: env('TTAPI_BASE_URL', TTAPI_DEFAULTS.baseUrl).replace(/\/$/, ''),
    apiKey,
    modelVersion: env('TTAPI_SUNO_MV', TTAPI_DEFAULTS.modelVersion),
    musicPath: TTAPI_DEFAULTS.musicPath,
    stemsAllPath: TTAPI_DEFAULTS.stemsAllPath,
    fetchPath: TTAPI_DEFAULTS.fetchPath,
  };
}

export function listLlmProviders() {
  return Object.entries(LLM_PRESETS).map(([id, preset]) => ({
    id,
    label: preset.label,
    type: preset.type,
  }));
}
