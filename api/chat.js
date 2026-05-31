const GROQ_KEY = process.env.GROQ_KEY;
const SERPER_KEY = process.env.SERPER_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
  if (!body) body = {};

  try {
    const messages = body.messages || [];
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';

    const needsSearch = /clima|tiempo|noticias|hoy|ahora|actual|precio|bolsa|partido|resultado|estreno|evento|últim|reciente/i.test(lastUserMsg);

    let searchContext = '';
    if (needsSearch && SERPER_KEY) {
      try {
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
          body: JSON.stringify({ q: lastUserMsg, gl: 'es', hl: 'es', num: 3 })
        });
        const serperData = await serperRes.json();
        const answerBox = serperData.answerBox?.answer || serperData.answerBox?.snippet || '';
        const snippets = (serperData.organic || []).slice(0,3).map(r => r.snippet||'').filter(Boolean).join(' | ');
        const context = (answerBox + ' ' + snippets).trim();
        if (context) searchContext = '\n\nINFO ACTUAL DE GOOGLE: ' + context;
      } catch(e) {}
    }

    const system = 'Eres un asistente IA en un Apple Watch. Responde SIEMPRE en español. Respuestas muy cortas: máximo 3 frases. Sin markdown, sin asteriscos, sin listas. Solo texto limpio.' + searchContext;
    const openaiMessages = [{ role: 'system', content: system }];
    for (const m of messages) openaiMessages.push({ role: m.role, content: m.content });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 300, messages: openaiMessages })
    });

    const data = await groqRes.json();
    if (!groqRes.ok) return res.status(200).json({ content: [{ type: 'text', text: 'Error: ' + (data?.error?.message || JSON.stringify(data)) }] });

    const text = data?.choices?.[0]?.message?.content || 'Sin respuesta.';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    return res.status(200).json({ content: [{ type: 'text', text: 'Error: ' + e.message }] });
  }
}
