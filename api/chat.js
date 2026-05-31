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
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';

    // Detect if query needs real-time info
    const needsSearch = /clima|tiempo|noticias|hoy|ahora|actual|precio|bolsa|partido|resultado|estreno|evento/i.test(lastUserMsg);

    let searchContext = '';
    if (needsSearch) {
      try {
        const query = encodeURIComponent(lastUserMsg);
        const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&skip_disambig=1`, {
          headers: { 'User-Agent': 'WatchAI/1.0' }
        });
        const ddgData = await ddgRes.json();
        const abstract = ddgData.AbstractText || '';
        const relatedTopics = (ddgData.RelatedTopics || [])
          .slice(0, 3)
          .map(t => t.Text || '')
          .filter(Boolean)
          .join(' | ');
        if (abstract || relatedTopics) {
          searchContext = `\n\nINFO ACTUAL DE INTERNET: ${abstract} ${relatedTopics}`.trim();
        }
      } catch(e) {
        // search failed silently, continue without context
      }
    }

    const openaiMessages = [];
    openaiMessages.push({ role: 'system', content: system + searchContext });
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
