import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: ANTHROPIC_API_KEY missing' });
  }

  const { prompt, documentType } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Write a complete ${documentType || 'legal'} document based on the request below. Return only the document text, with no preamble or commentary.\n\n${prompt}`
        }
      ]
    });

    const content = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return res.status(200).json({ content });
  } catch (error) {
    console.error('Error generating document:', error);
    return res.status(500).json({ error: 'Unable to generate document' });
  }
}
