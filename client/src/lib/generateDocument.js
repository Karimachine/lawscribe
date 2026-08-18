// Shared by the authenticated dashboard generator (AppShell) and the public
// homepage demo (DemoGenerator) so there is exactly one place that calls the
// Claude API integration. Authorization is optional here on purpose --
// /api/generate accepts anonymous calls (the public demo) as well as
// authenticated ones; passing accessToken when available gets the caller
// identified server-side and a higher rate-limit tier (see generate.js).
export async function generateDocument({ prompt, documentType, accessToken }) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, documentType })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // status/serverMessage let callers distinguish "session expired"
    // (401) and "rate limited" (429) from a generic failure, instead of
    // collapsing every failure into the same message.
    const error = new Error(data?.error || 'Failed to generate document');
    error.status = response.status;
    error.serverMessage = data?.message;
    throw error;
  }

  return data.content || '';
}
