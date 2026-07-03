async function parseError(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.error?.message || json.message || text;
  } catch {
    return text;
  }
}

export async function callOpenAiCompatible({ baseUrl, apiKey, model, prompt, extraHeaders = {} }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI-compatible API error (${res.status}): ${await parseError(res)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function callAnthropic({ baseUrl, apiKey, model, prompt }) {
  const url = `${baseUrl.replace(/\/$/, '')}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status}): ${await parseError(res)}`);
  }

  const data = await res.json();
  const block = data.content?.find((b) => b.type === 'text');
  return block?.text?.trim() || '';
}

export async function callGemini({ baseUrl, apiKey, model, prompt }) {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${await parseError(res)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callHttpLlm(config, prompt) {
  switch (config.type) {
    case 'anthropic':
      return callAnthropic(config, prompt);
    case 'gemini':
      return callGemini(config, prompt);
    case 'openai-compatible':
    default:
      return callOpenAiCompatible(config, prompt);
  }
}
