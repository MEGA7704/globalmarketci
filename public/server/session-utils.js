export function dateOnlyPlusDays(startValue, days) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(startValue || ''))
    ? new Date(String(startValue) + 'T00:00:00Z')
    : new Date();
  return new Date(base.getTime() + Number(days || 0) * 86400000).toISOString().slice(0, 10);
}

export function companyStatus(company) {
  if (!company) return 'blocked';
  if (['blocked', 'suspended'].includes(company.status)) return company.status;
  const today = new Date().toISOString().slice(0, 10);
  if (company.subscriptionEnd && company.subscriptionEnd < today) return 'expired';
  return company.status || company.planCode || 'FREE';
}

export function isCashierInAllowedHours(user, now = new Date()) {
  if (user?.role !== 'caisse') return true;
  const valid = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
  const startText = valid(user.caisseStartTime) ? user.caisseStartTime : '07:00';
  const endText = valid(user.caisseEndTime) ? user.caisseEndTime : '22:00';
  const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const start = toMinutes(startText);
  const end = toMinutes(endText);
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  return start < end ? current >= start && current <= end : current >= start || current <= end;
}

export function publicSessionView(session) {
  if (!session) return null;
  return {
    userId: session.userId,
    companyId: session.companyId,
    role: session.role,
    loginAt: session.loginAt,
    expiresAt: session.expiresAt,
    csrfToken: session.csrfToken
  };
}

export function publicClientSessionView(session) {
  if (!session) return null;
  return {
    clientId: session.clientId,
    companyId: session.companyId,
    expiresAt: session.expiresAt,
    csrfToken: session.csrfToken
  };
}
