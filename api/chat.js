export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-provider');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(200).json({ content: [{ type: 'text', text: 'Error: falta API key' }] });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
  if (!body) body = {};

  try {
    const messages = body.messages || [];
    const system = body.system || '';
    const openaiMessages = [];
    if (system) openaiMessages.push({ role: 'system', content: system });
    for (const m of messages) openaiMessages.push({ role: m.role, content: m.content });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        messages: openaiMessages
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      const errMsg = data?.error?.message || JSON.stringify(data);
      return res.status(200).json({ content: [{ type: 'text', text: 'Error: ' + errMsg }] });
    }

    const text = data?.choices?.[0]?.message?.content || 'Sin respuesta.';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    return res.status(200).json({ content: [{ type: 'text', text: 'Error: ' + e.message }] });
  }
}
