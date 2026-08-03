const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Parses ?page=&limit= query params, clamping invalid/out-of-range values
// to sane defaults rather than rejecting the request.
export function parsePagination(query) {
  const rawPage = Number.parseInt(query?.page, 10);
  const rawLimit = Number.parseInt(query?.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { page, limit, from, to };
}
