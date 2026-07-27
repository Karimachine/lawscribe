// Shared by the authenticated dashboard generator (AppShell) and the public
// homepage demo (DemoGenerator) so there is exactly one place that calls the
// Claude API integration.
export async function generateDocument({ prompt, documentType }) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt, documentType })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to generate document');
  }

  return data.content || '';
}
