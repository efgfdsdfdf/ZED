// ─────────────────────────────────────────────────────────────────
// ADD THIS ROUTE to your server.js  (paste after the /api/openai route)
// ─────────────────────────────────────────────────────────────────

// Calorie analysis — dedicated endpoint for food image scanning
// Accepts same payload as /api/anthropic but enforces max_tokens
app.post('/api/calorie', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is missing on the server' });
    }

    const { messages, model, max_tokens, system } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      model      || 'claude-opus-4-5',   // use Opus for best food ID accuracy
        max_tokens: max_tokens || 1200,
        system:     system     || '',
        messages:   messages.map(({ role, content }) => ({ role, content }))
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API error');
    res.status(200).json(data);

  } catch (error) {
    console.error('Calorie scan error:', error);
    res.status(500).json({ error: error.message });
  }
});
