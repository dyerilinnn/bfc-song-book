module.exports = function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Sign in as the admin to do that.' });
};
