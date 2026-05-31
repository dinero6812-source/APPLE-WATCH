export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-provider');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(400).json({ error: { message: 'Missing API key' } });

  try {
    const messages = req.body.messages || [];
    const system = req.body.system;
    const openaiMessages = [];
    if (system) openaiMessages.push({ role: 'system', content: system });
    openaiMessages.push(...messages);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 500,
        messages: openaiMessages
      })
    });

    const data = await response.json();
    console.log('GROQ STATUS:', response.status);
    console.log('GROQ DATA:', JSON.stringify(data));

    if (!response.ok) {
      return res.status(200).json({ content: [{ type: 'text', text: 'Error Groq: ' + (data.error?.message || JSON.stringify(data)) }] });
    }

    const text = data.choices?.[0]?.message?.content || 'Sin respuesta.';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    console.log('EXCEPTION:', e.message);
    return res.status(200).json({ content: [{ type: 'text', text: 'Error: ' + e.message }] });
  }
}
