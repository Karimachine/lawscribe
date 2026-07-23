const supabase = require('./supabaseClient');

async function getUserFromToken(authHeader) {
  if (!supabase) {
    return null;
  }

  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

module.exports = {
  getUserFromToken
};
