export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-provider');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = req.headers['x-api-key'];
  const provider = req.headers['x-provider'] || 'groq';

  if (!apiKey) return res.status(400).json({ error: { message: 'Missing API key' } });

  try {
    let url, headers, body;

    if (provider === 'groq') {
      url = 'https://api.groq.com/openai/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      // Convert Anthropic-style messages to OpenAI format
      const messages = req.body.messages || [];
      const system = req.body.system;
      const openaiMessages = [];
      if (system) openaiMessages.push({ role: 'system', content: system });
      openaiMessages.push(...messages);
      body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 500,
        messages: openaiMessages
      });
    } else {
      // Anthropic
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };
      body = JSON.stringify(req.body);
    }

    const response = await fetch(url, { method: 'POST', headers, body });
    const data = await response.json();

    // Normalize Groq response to Anthropic format
    if (provider === 'groq') {
      const text = data.choices?.[0]?.message?.content || 'Sin respuesta.';
      return res.status(200).json({ content: [{ type: 'text', text }] });
    }

    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
