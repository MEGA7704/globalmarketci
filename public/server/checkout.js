const DAY = 24 * 60 * 60 * 1000;

function isPendingSale(sale) {
  const status = String(sale?.saleStatus || sale?.status || '').toLowerCase();
  return status === 'cart' || status === 'panier' || sale?.cartPending === true;
}

function saleKind(sale) {
  const raw = String(sale?.saleKind || sale?.type || sale?.kind || '').toLowerCase();
  return ['boutique', 'produit', 'product', 'stock', 'article'].includes(raw) ? 'boutique' : 'service';
}

function stockQuantity(item) {
  if (String(item?.stockType || 'limited').toLowerCase() === 'unlimited') return Infinity;
  for (const key of ['stock', 'stockAvailable', 'stockDisponible', 'stockQty', 'quantity', 'qty', 'qte', 'quantite']) {
    if (Object.prototype.hasOwnProperty.call(item || {}, key)) {
      const value = Number(item[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return 0;
}

function setStockQuantity(item, value) {
  const next = Math.max(0, Number(value) || 0);
  for (const key of ['stock', 'stockAvailable', 'stockDisponible', 'stockQty', 'quantity', 'qty', 'qte', 'quantite']) {
    if (Object.prototype.hasOwnProperty.call(item || {}, key)) {
      item[key] = next;
      return;
    }
  }
  item.stock = next;
}

function cleanText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function checkoutDateCode(now = new Date()) {
  return now.toISOString().slice(0, 10).replaceAll('-', '');
}

function parseJson(value, fallback = null) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function checkoutSummary(state, checkoutId) {
  const rows = (state.sales || []).filter(row => row?.checkoutId === checkoutId && !isPendingSale(row));
  if (!rows.length) return null;
  return {
    checkoutId,
    saleNumber: rows[0]?.saleNumber || checkoutId,
    lineIds: rows.map(row => row.id),
    total: rows.reduce((sum, row) => sum + Number(row.total || 0), 0),
    clientsServed: Math.max(1, ...rows.map(row => Number(row.clientsServedTransaction || row.transactionClientsServed || row.clientsServed || 1)))
  };
}

async function readCheckoutRequest(env, companyId, idempotencyKey) {
  return env.GLOBAL_MARKET_D1.prepare(`SELECT checkout_id, status, revision, result_json, error_code, updated_at
    FROM gm_checkout_requests WHERE company_id = ? AND idempotency_key = ?`)
    .bind(companyId, idempotencyKey).first();
}

async function reserveCheckout(env, companyId, idempotencyKey, checkoutId, userId, now) {
  const result = await env.GLOBAL_MARKET_D1.prepare(`INSERT OR IGNORE INTO gm_checkout_requests
    (company_id, idempotency_key, checkout_id, cashier_id, status, revision, result_json, error_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'processing', 0, '', '', ?, ?)`)
    .bind(companyId, idempotencyKey, checkoutId, userId, now, now).run();
  return Number(result?.meta?.changes || 0) === 1;
}

async function markCheckout(env, companyId, idempotencyKey, values) {
  await env.GLOBAL_MARKET_D1.prepare(`UPDATE gm_checkout_requests
    SET checkout_id = ?, status = ?, revision = ?, result_json = ?, error_code = ?, updated_at = ?
    WHERE company_id = ? AND idempotency_key = ?`)
    .bind(values.checkoutId || '', values.status || '', Number(values.revision || 0), values.resultJson || '', values.errorCode || '', values.updatedAt || new Date().toISOString(), companyId, idempotencyKey).run();
}

export async function executeCartCheckout(request, env, deps) {
  const {
    getEmployeeSession,
    requireRole,
    readJson,
    storageRevision,
    saveCompanyFromState,
    scopeState,
    HttpError,
    audit,
    requestIp,
    ensureDB
  } = deps;

  const ctx = await getEmployeeSession(request, env, true);
  requireRole(ctx.user, ['admin', 'caisse']);
  await ensureDB(env);

  const body = await readJson(request, 500_000);
  const companyId = String(ctx.user.companyId || '');
  const idempotencyKey = cleanText(body.idempotencyKey, 120);
  const expectedRevision = Number(body.expectedRevision);
  const lineIds = [...new Set((Array.isArray(body.cartLineIds) ? body.cartLineIds : []).map(value => cleanText(value, 160)).filter(Boolean))];

  if (!/^[A-Za-z0-9._:-]{16,120}$/.test(idempotencyKey)) {
    throw new HttpError(400, 'Clé de validation invalide.', 'INVALID_IDEMPOTENCY_KEY');
  }
  if (!lineIds.length || lineIds.length > 150) {
    throw new HttpError(400, 'Le panier doit contenir entre 1 et 150 lignes.', 'INVALID_CART_LINES');
  }

  const currentRevision = storageRevision(ctx.state);
  const now = new Date();
  const nowIso = now.toISOString();
  let checkoutId = `VTE-${checkoutDateCode(now)}-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;

  const existing = await readCheckoutRequest(env, companyId, idempotencyKey);
  if (existing) {
    const knownId = String(existing.checkout_id || checkoutId);
    const summary = checkoutSummary(ctx.state, knownId);
    if (existing.status === 'completed' || summary) {
      if (summary && existing.status !== 'completed') {
        await markCheckout(env, companyId, idempotencyKey, {
          checkoutId: knownId,
          status: 'completed',
          revision: currentRevision,
          resultJson: JSON.stringify(summary),
          updatedAt: nowIso
        });
      }
      return { success: true, replayed: true, ...(summary || parseJson(existing.result_json, { checkoutId: knownId, revision: Number(existing.revision || currentRevision) })) };
    }
    const age = now.getTime() - new Date(existing.updated_at || 0).getTime();
    if (existing.status === 'processing' && Number.isFinite(age) && age < 2 * 60 * 1000) {
      throw new HttpError(409, 'Cet encaissement est déjà en cours de traitement.', 'CHECKOUT_IN_PROGRESS');
    }
    checkoutId = knownId || checkoutId;
    await markCheckout(env, companyId, idempotencyKey, {
      checkoutId,
      status: 'processing',
      revision: currentRevision,
      updatedAt: nowIso
    });
  } else {
    if (Number.isFinite(expectedRevision) && expectedRevision >= 0 && expectedRevision !== currentRevision) {
      throw new HttpError(409, 'Les données ont changé sur un autre appareil. Actualisez le panier avant de valider.', 'COMPANY_DATA_CONFLICT');
    }
    const reserved = await reserveCheckout(env, companyId, idempotencyKey, checkoutId, ctx.user.id, nowIso);
    if (!reserved) throw new HttpError(409, 'Cet encaissement est déjà en cours de traitement.', 'CHECKOUT_IN_PROGRESS');
  }

  try {
    const state = structuredClone(ctx.state);
    const cartRows = (state.sales || []).filter(row => row?.companyId === companyId
      && isPendingSale(row)
      && lineIds.includes(String(row.id))
      && (ctx.user.role !== 'caisse' || !row.userId || String(row.userId) === String(ctx.user.id)));
    if (cartRows.length !== lineIds.length) {
      throw new HttpError(409, 'Une ou plusieurs lignes du panier ont changé. Actualisez avant de recommencer.', 'CART_CHANGED');
    }

    const client = body.client && typeof body.client === 'object' ? body.client : {};
    const clientType = client.type === 'contrat' ? 'contrat' : 'particulier';
    let clientLabel = '';
    let contractClientId = '';
    let clientPhone = '';
    let clientAddress = '';
    if (clientType === 'contrat') {
      contractClientId = cleanText(client.contractClientId, 160);
      const contract = (state.clients || []).find(row => row?.companyId === companyId && String(row.id) === contractClientId);
      if (!contract) throw new HttpError(400, 'Client sous contrat introuvable.', 'CONTRACT_CLIENT_NOT_FOUND');
      clientLabel = [contract.name, contract.phone, contract.address].map(value => cleanText(value)).filter(Boolean).join(' / ');
    } else {
      const name = cleanText(client.name, 200);
      clientPhone = cleanText(client.phone, 80);
      clientAddress = cleanText(client.address, 250);
      if (!name) throw new HttpError(400, 'Le nom du client est obligatoire.', 'CUSTOMER_REQUIRED');
      clientLabel = [name, clientPhone, clientAddress].filter(Boolean).join(' / ');
    }

    const grouped = new Map();
    for (const row of cartRows) {
      if (saleKind(row) !== 'boutique') continue;
      const itemId = cleanText(row.itemId, 160);
      const qty = Math.max(1, Math.floor(Number(row.qty || 1)));
      grouped.set(itemId, (grouped.get(itemId) || 0) + qty);
    }

    state.stockMovements = Array.isArray(state.stockMovements) ? state.stockMovements : [];
    for (const [itemId, quantity] of grouped.entries()) {
      const item = (state.items || []).find(row => row?.companyId === companyId && String(row.id) === itemId);
      if (!item) throw new HttpError(409, 'Un produit du panier est introuvable.', 'PRODUCT_NOT_FOUND');
      if (String(item.stockType || 'limited').toLowerCase() === 'unlimited') continue;
      const before = stockQuantity(item);
      if (before < quantity) throw new HttpError(409, `Stock insuffisant pour ${cleanText(item.name || 'ce produit')}.`, 'STOCK_INSUFFICIENT');
      const after = before - quantity;
      setStockQuantity(item, after);
      state.stockMovements.push({
        id: `mov_${crypto.randomUUID()}`,
        companyId,
        itemId,
        itemName: cleanText(item.name, 250),
        checkoutId,
        movementType: 'sale',
        quantityBefore: before,
        quantityChange: -quantity,
        quantityAfter: after,
        userId: ctx.user.id,
        userName: cleanText(ctx.user.name || ctx.user.email, 200),
        date: nowIso
      });
    }

    const clientsServed = Math.max(1, ...cartRows.map(row => Math.max(1, Math.floor(Number(row.clientsServed || 1)))));
    const total = cartRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    for (const row of cartRows) {
      row.client = clientLabel;
      row.clientType = clientType;
      row.contractClientId = contractClientId;
      row.clientPhone = clientType === 'contrat' ? '' : clientPhone;
      row.clientAddress = clientType === 'contrat' ? '' : clientAddress;
      row.saleStatus = 'validated';
      row.status = 'validated';
      row.cartPending = false;
      row.checkoutId = checkoutId;
      row.saleNumber = checkoutId;
      row.clientsServedTransaction = clientsServed;
      row.transactionClientsServed = clientsServed;
      row.validatedAt = nowIso;
      row.cartCreatedAt = row.cartCreatedAt || row.date;
      row.date = nowIso;
    }

    state.saleCartMeta = state.saleCartMeta && typeof state.saleCartMeta === 'object' ? state.saleCartMeta : {};
    state.saleCartMeta[companyId] = { clientType: 'particulier', clientName: '', phone: '', address: '', contractClientId: '' };
    state.caisseLogs = Array.isArray(state.caisseLogs) ? state.caisseLogs : [];
    state.caisseLogs.push({
      id: `log_${crypto.randomUUID()}`,
      companyId,
      userId: ctx.user.id,
      userName: cleanText(ctx.user.name || ctx.user.email, 200),
      action: 'Encaissement panier transactionnel',
      details: `${cartRows.length} ligne(s) — ${clientLabel} — ${total} FCFA`,
      checkoutId,
      date: nowIso
    });
    if (state.caisseLogs.length > 1500) state.caisseLogs = state.caisseLogs.slice(-1500);

    const result = await saveCompanyFromState(env, state, companyId, {
      catalog: ctx.catalog,
      expectedRevision: currentRevision
    });
    const summary = {
      checkoutId,
      saleNumber: checkoutId,
      lineIds,
      total,
      clientsServed,
      revision: Number(result.state?.app?.storageRevision || currentRevision + 1)
    };
    await markCheckout(env, companyId, idempotencyKey, {
      checkoutId,
      status: 'completed',
      revision: summary.revision,
      resultJson: JSON.stringify(summary),
      updatedAt: nowIso
    });
    await audit(env, 'CART_CHECKOUT_COMPLETED', ctx.user.id, companyId, JSON.stringify({ checkoutId, lineCount: lineIds.length, total }), requestIp(request));
    return { success: true, replayed: false, ...summary, data: scopeState(result.state, ctx.user) };
  } catch (error) {
    await markCheckout(env, companyId, idempotencyKey, {
      checkoutId,
      status: 'failed',
      revision: currentRevision,
      errorCode: error?.code || 'CHECKOUT_FAILED',
      updatedAt: new Date().toISOString()
    }).catch(() => {});
    throw error;
  }
}
