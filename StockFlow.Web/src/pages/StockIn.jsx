import { useEffect, useRef, useState } from 'react';
import { stockApi, companiesApi } from '../api/client';
import ProductSearch from '../components/ProductSearch';
import { useTranslation } from 'react-i18next';

const UNIT_LABELS = { 0: 'pcs', 1: 'm', 2: 'm²', 3: 'L' };
const UNIT_IS_DECIMAL = { 0: false, 1: true, 2: true, 3: true };
const PAGE_SIZE = 20;

const TYPE_STYLE = {
  StockIn:    { bg: '#D1FAE5', color: '#065F46' },
  Sale:       { bg: '#FEE2E2', color: '#B91C1C' },
  Return:     { bg: '#FEF3C7', color: '#92400E' },
  Adjustment: { bg: '#EDE9FE', color: '#5B21B6' },
};

function loadPoCart() {
  try { return JSON.parse(localStorage.getItem('stock_po_cart') || '[]'); } catch { return []; }
}
function savePoCart(cart) { localStorage.setItem('stock_po_cart', JSON.stringify(cart)); }

export default function StockIn() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(() => localStorage.getItem('stock_active_tab') || 'quick');

  // ---- Quick Add tab ----
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchKey, setSearchKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [movements, setMovements] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingTable, setLoadingTable] = useState(false);

  const debounceRef = useRef(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ---- Purchase Order tab ----
  const [companies, setCompanies] = useState([]);
  const [poCompanyId, setPoCompanyId] = useState(() => localStorage.getItem('stock_po_company') || '');
  const [poCart, setPoCart] = useState(loadPoCart);
  const [poQtyDrafts, setPoQtyDrafts] = useState({});
  const [poBuyDrafts, setPoBuyDrafts] = useState({});
  const [poSellDrafts, setPoSellDrafts] = useState({});
  const [poPayFromRegister, setPoPayFromRegister] = useState(() => localStorage.getItem('stock_po_pay_from_register') !== 'false');
  const [poError, setPoError] = useState('');
  const [poStep, setPoStep] = useState('cart'); // 'cart' | 'review' | 'done'
  const [poLoading, setPoLoading] = useState(false);
  const [poResult, setPoResult] = useState(null);
  const poSearchRef = useRef();

  useEffect(() => { localStorage.setItem('stock_active_tab', tab); }, [tab]);
  useEffect(() => { savePoCart(poCart); }, [poCart]);
  useEffect(() => { localStorage.setItem('stock_po_company', poCompanyId); }, [poCompanyId]);
  useEffect(() => { localStorage.setItem('stock_po_pay_from_register', String(poPayFromRegister)); }, [poPayFromRegister]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const loadMovements = async (q, p) => {
    setLoadingTable(true);
    try {
      const { data } = await stockApi.getMovements({ query: q, page: p, pageSize: PAGE_SIZE });
      setMovements(data.items);
      setTotalCount(data.totalCount);
    } catch {
      // silently fail for table load
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    loadMovements(search, page);
  }, [page]);

  useEffect(() => {
    companiesApi.getAll().then(r => setCompanies(Array.isArray(r.data) ? r.data : [])).catch(() => setCompanies([]));
  }, []);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      loadMovements(q, 1);
    }, 300);
  };

  const handlePageChange = (next) => {
    if (next < 1 || next > totalPages) return;
    setPage(next);
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setQuantity('');
    setBuyingPrice(product.buyingPrice != null ? String(product.buyingPrice) : '');
    setSellingPrice(product.sellingPrice != null ? String(product.sellingPrice) : '');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(''); setMessage('');
    if (!selectedProduct) { setError(t('stock.errors.selectProduct')); return; }
    const isDecimal = UNIT_IS_DECIMAL[selectedProduct.unitType ?? 0];
    const qty = isDecimal ? parseFloat(quantity) : parseInt(quantity);
    if (!qty || qty <= 0) { setError(t('stock.errors.quantity')); return; }
    const price = parseFloat(buyingPrice);
    if (!price || price <= 0) { setError(t('stock.errors.buyingPrice')); return; }
    const sellPrice = parseFloat(sellingPrice);
    if (!sellPrice || sellPrice <= 0) { setError(t('stock.errors.sellingPrice')); return; }
    setSubmitting(true);
    try {
      await stockApi.stockIn({ productId: selectedProduct.id, quantity: qty, note: note || null, buyingPrice: price, sellingPrice: sellPrice });
      setMessage(`+ ${qty} ${UNIT_LABELS[selectedProduct.unitType ?? 0]} — ${selectedProduct.name}`);
      setSelectedProduct(null);
      setQuantity('');
      setBuyingPrice('');
      setSellingPrice('');
      setNote('');
      setSearchKey(k => k + 1);
      setPage(1);
      loadMovements(search, 1);
    } catch (err) {
      setError(err.response?.data?.error || t('stock.errors.stockError'));
    } finally {
      setSubmitting(false);
    }
  };

  const isDecimal = UNIT_IS_DECIMAL[selectedProduct?.unitType ?? 0];
  const unitLabel = selectedProduct ? UNIT_LABELS[selectedProduct.unitType ?? 0] : '';

  // ---- Purchase Order handlers ----

  const handlePoProductSelect = (product) => {
    setPoError('');
    setPoCart(prev => {
      const existing = prev.find(l => l.productId === product.id);
      if (existing) return prev.map(l => l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        unitType: product.unitType ?? 0,
        quantity: 1,
        buyingPrice: product.buyingPrice != null ? product.buyingPrice : 0,
        sellingPrice: product.sellingPrice != null ? product.sellingPrice : 0,
      }];
    });
  };

  const handlePoQtyChange = (productId, rawVal) => {
    const item = poCart.find(l => l.productId === productId);
    if (!item) return;
    const isDec = UNIT_IS_DECIMAL[item.unitType];
    if (!(isDec ? /^\d*\.?\d*$/.test(rawVal) : /^\d*$/.test(rawVal))) return;
    setPoQtyDrafts(prev => ({ ...prev, [productId]: rawVal }));
    const qty = isDec ? parseFloat(rawVal) : parseInt(rawVal, 10);
    if (!qty || qty <= 0) return;
    setPoCart(prev => prev.map(l => l.productId === productId ? { ...l, quantity: qty } : l));
  };
  const handlePoQtyBlur = (productId) => {
    setPoQtyDrafts(prev => { if (!(productId in prev)) return prev; const next = { ...prev }; delete next[productId]; return next; });
  };

  const handlePoBuyChange = (productId, rawVal) => {
    if (!/^\d*\.?\d*$/.test(rawVal)) return;
    setPoBuyDrafts(prev => ({ ...prev, [productId]: rawVal }));
    if (rawVal === '' || rawVal === '.') return;
    const price = parseFloat(rawVal);
    setPoCart(prev => prev.map(l => l.productId === productId ? { ...l, buyingPrice: price } : l));
  };
  const handlePoBuyBlur = (productId) => {
    setPoBuyDrafts(prev => { if (!(productId in prev)) return prev; const next = { ...prev }; delete next[productId]; return next; });
  };

  const handlePoSellChange = (productId, rawVal) => {
    if (!/^\d*\.?\d*$/.test(rawVal)) return;
    setPoSellDrafts(prev => ({ ...prev, [productId]: rawVal }));
    if (rawVal === '' || rawVal === '.') return;
    const price = parseFloat(rawVal);
    setPoCart(prev => prev.map(l => l.productId === productId ? { ...l, sellingPrice: price } : l));
  };
  const handlePoSellBlur = (productId) => {
    setPoSellDrafts(prev => { if (!(productId in prev)) return prev; const next = { ...prev }; delete next[productId]; return next; });
  };

  const removePoLine = (productId) => setPoCart(prev => prev.filter(l => l.productId !== productId));

  const resetPurchaseOrder = () => {
    setPoCart([]); setPoQtyDrafts({}); setPoBuyDrafts({}); setPoSellDrafts({});
    setPoCompanyId(''); setPoPayFromRegister(true); setPoError(''); setPoStep('cart'); setPoResult(null);
  };

  const poTotalCost = poCart.reduce((sum, l) => sum + l.quantity * l.buyingPrice, 0);
  const poSelectedCompany = (companies || []).find(c => String(c.id) === String(poCompanyId));

  const handleReviewPurchase = () => {
    setPoError('');
    if (poCart.length === 0) { setPoError(t('stock.po.errorEmpty')); return; }
    for (const l of poCart) {
      if (!l.buyingPrice || l.buyingPrice <= 0) { setPoError(t('stock.errors.buyingPrice')); return; }
      if (!l.sellingPrice || l.sellingPrice <= 0) { setPoError(t('stock.errors.sellingPrice')); return; }
    }
    setPoStep('review');
  };

  const handleConfirmPurchase = async () => {
    setPoLoading(true); setPoError('');
    try {
      const { data } = await stockApi.bulkStockIn({
        userId: JSON.parse(localStorage.getItem('stockflow_user') || 'null')?.id,
        companyId: poCompanyId ? Number(poCompanyId) : null,
        payFromRegister: poPayFromRegister,
        items: poCart.map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          buyingPrice: l.buyingPrice,
          sellingPrice: l.sellingPrice,
        })),
      });
      setPoResult(data);
      setPoStep('done');
      loadMovements(search, page);
    } catch (err) {
      setPoError(err.response?.data?.error || t('common.error'));
    } finally {
      setPoLoading(false);
    }
  };

  return (
    <div>
      <div style={s.pageHeader}>
        <h2 style={s.title}>{t('stock.title')}</h2>
        <p style={s.subtitle}>{t('stock.subtitle')}</p>
      </div>

      <div style={s.tabBar}>
        {['quick', 'po'].map(key => (
          <button key={key}
            style={{ ...s.tab, ...(tab === key ? s.activeTab : {}) }}
            onClick={() => setTab(key)}>
            {t(`stock.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'quick' && (
        <>
          <div style={s.card}>
            <h3 style={s.cardTitle}>{t('stock.addStock')}</h3>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>{t('stock.product')}</label>
                <ProductSearch key={searchKey} onSelect={handleProductSelect} placeholder={t('stock.searchPlaceholder')} />
                {selectedProduct && (
                  <div style={s.selectedBadge}>
                    <span>✓</span>
                    <span>
                      <strong>{selectedProduct.name}</strong> · {selectedProduct.barcode} · {t('stock.currentStock')}:{' '}
                      <strong>{selectedProduct.stockQuantity} {unitLabel}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div style={s.fourCol}>
                <div style={s.field}>
                  <label style={s.label}>{t('common.quantity')}{unitLabel ? ` (${unitLabel})` : ''} *</label>
                  <input
                    style={{ ...s.input, borderColor: quantity.trim() === '' ? '#DC2626' : '#E5E7EB' }}
                    type="text"
                    inputMode={isDecimal ? 'decimal' : 'numeric'}
                    required
                    placeholder={isDecimal ? 'e.g. 12.5' : 'e.g. 10'}
                    value={quantity}
                    onChange={e => {
                      const v = e.target.value;
                      if (isDecimal ? /^\d*\.?\d*$/.test(v) : /^\d*$/.test(v)) setQuantity(v);
                    }}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>{t('stock.buyingPrice')} (₾) *</label>
                  <input
                    style={{ ...s.input, borderColor: buyingPrice.trim() === '' ? '#DC2626' : '#E5E7EB' }}
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="e.g. 15.00"
                    value={buyingPrice}
                    onChange={e => {
                      const v = e.target.value;
                      if (/^\d*\.?\d*$/.test(v)) setBuyingPrice(v);
                    }}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>{t('stock.sellingPrice')} (₾) *</label>
                  <input
                    style={{ ...s.input, borderColor: sellingPrice.trim() === '' ? '#DC2626' : '#E5E7EB' }}
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="e.g. 20.00"
                    value={sellingPrice}
                    onChange={e => {
                      const v = e.target.value;
                      if (/^\d*\.?\d*$/.test(v)) setSellingPrice(v);
                    }}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>{t('stock.note')}</label>
                  <input style={s.input} placeholder={t('stock.notePlaceholder')}
                    value={note} onChange={e => setNote(e.target.value)} />
                </div>
              </div>

              {message && <div style={s.successBox}>{message}</div>}
              {error && <div style={s.errorBox}>{error}</div>}

              <button style={{ ...s.submitBtn, opacity: submitting ? 0.7 : 1 }} type="submit" disabled={submitting}>
                {submitting ? t('stock.saving') : t('stock.addButton')}
              </button>
            </form>
          </div>

          <div style={s.tableHeader}>
            <div>
              <h3 style={s.sectionTitle}>{t('stock.movements')}</h3>
              <p style={s.sectionSub}>{t('stock.totalRecords', { count: totalCount })}</p>
            </div>
            <input
              style={s.searchInput}
              placeholder={t('stock.searchMovements')}
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{t('stock.col.date')}</th>
                  <th style={s.th}>{t('stock.col.product')}</th>
                  <th style={s.th}>{t('stock.col.barcode')}</th>
                  <th style={s.th}>{t('stock.col.type')}</th>
                  <th style={s.th}>{t('stock.col.quantity')}</th>
                  <th style={s.th}>{t('stock.col.note')}</th>
                </tr>
              </thead>
              <tbody style={{ opacity: loadingTable ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                {movements.map(m => {
                  const ts = TYPE_STYLE[m.type] ?? { bg: '#F3F4F8', color: '#374151' };
                  return (
                    <tr key={m.id} style={s.tr}>
                      <td style={{ ...s.td, color: '#6B7280', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                      <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{m.productName}</td>
                      <td style={s.td}><code style={s.code}>{m.barcode}</code></td>
                      <td style={s.td}>
                        <span style={{ ...s.typeBadge, background: ts.bg, color: ts.color }}>{m.type}</span>
                      </td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{m.quantity}</td>
                      <td style={{ ...s.td, color: '#6B7280' }}>{m.note || '—'}</td>
                    </tr>
                  );
                })}
                {movements.length === 0 && !loadingTable && (
                  <tr>
                    <td colSpan={6} style={s.empty}>
                      {search ? t('stock.noMovementsSearch', { query: search }) : t('stock.noMovements')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={s.pagination}>
              <button style={{ ...s.pageBtn, opacity: page <= 1 ? 0.4 : 1 }} onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                {t('stock.prev')}
              </button>
              <span style={s.pageInfo}>{t('stock.pageOf', { page, total: totalPages })}</span>
              <button style={{ ...s.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }} onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                {t('stock.next')}
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'po' && poStep === 'cart' && (
        <div style={s.poLayout}>
          <div style={s.poLeft}>
            <div style={s.card}>
              <h3 style={s.cardTitle}>{t('stock.po.company')}</h3>
              <select style={s.input} value={poCompanyId} onChange={e => setPoCompanyId(e.target.value)}>
                <option value="">{t('stock.po.noCompany')}</option>
                {(companies || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <ProductSearch ref={poSearchRef} clearAfterSelect autoFocus onSelect={handlePoProductSelect} placeholder={t('stock.searchPlaceholder')} />
            {poError && <p style={s.errorBox}>{poError}</p>}

            {poCart.length === 0 ? (
              <div style={s.emptyCart}>{t('stock.po.cartEmpty')}</div>
            ) : (
              <table style={s.poTable}>
                <thead>
                  <tr style={s.poThead}>
                    <th style={s.poTh}>{t('stock.col.product')}</th>
                    <th style={s.poTh}>{t('common.quantity')}</th>
                    <th style={s.poTh}>{t('stock.buyingPrice')}</th>
                    <th style={s.poTh}>{t('stock.sellingPrice')}</th>
                    <th style={s.poTh}>{t('stock.po.lineTotal')}</th>
                    <th style={s.poTh}></th>
                  </tr>
                </thead>
                <tbody>
                  {poCart.map(line => {
                    const isDec = UNIT_IS_DECIMAL[line.unitType];
                    const unit = UNIT_LABELS[line.unitType] ?? 'pcs';
                    const qtyDraft = poQtyDrafts[line.productId];
                    const buyDraft = poBuyDrafts[line.productId];
                    const sellDraft = poSellDrafts[line.productId];
                    return (
                      <tr key={line.productId} style={s.poTr}>
                        <td style={s.poTd}>
                          <div style={{ fontWeight: 600 }}>{line.name}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{line.barcode}</div>
                        </td>
                        <td style={s.poTd}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="text"
                              inputMode={isDec ? 'decimal' : 'numeric'}
                              style={{ ...s.smallInput, width: 65 }}
                              value={qtyDraft ?? line.quantity}
                              onChange={e => handlePoQtyChange(line.productId, e.target.value)}
                              onBlur={() => handlePoQtyBlur(line.productId)}
                            />
                            <span style={{ fontSize: 12, color: '#64748b' }}>{unit}</span>
                          </div>
                        </td>
                        <td style={s.poTd}>
                          <input
                            type="text"
                            inputMode="decimal"
                            style={s.smallInput}
                            value={buyDraft ?? line.buyingPrice}
                            onChange={e => handlePoBuyChange(line.productId, e.target.value)}
                            onBlur={() => handlePoBuyBlur(line.productId)}
                          />
                        </td>
                        <td style={s.poTd}>
                          <input
                            type="text"
                            inputMode="decimal"
                            style={s.smallInput}
                            value={sellDraft ?? line.sellingPrice}
                            onChange={e => handlePoSellChange(line.productId, e.target.value)}
                            onBlur={() => handlePoSellBlur(line.productId)}
                          />
                        </td>
                        <td style={{ ...s.poTd, fontWeight: 600 }}>
                          {(line.quantity * line.buyingPrice).toFixed(2)} ₾
                        </td>
                        <td style={s.poTd}>
                          <button style={s.removeBtn} onClick={() => removePoLine(line.productId)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={s.poRight}>
            <div style={s.totalRow}>
              <span>{t('stock.po.totalCost')}</span>
              <span>{poTotalCost.toFixed(2)} ₾</span>
            </div>

            <div style={s.payTypeSection}>
              <div style={s.payTypeLabel}>{t('stock.po.paymentMethod')}</div>
              <div style={s.payTypeRow}>
                <button
                  style={{ ...s.payTypeBtn, ...(poPayFromRegister ? s.payTypeBtnActive : {}) }}
                  onClick={() => setPoPayFromRegister(true)}
                >
                  {t('stock.po.fromRegister')}
                </button>
                <button
                  style={{ ...s.payTypeBtn, ...(!poPayFromRegister ? s.payTypeBtnOther : {}) }}
                  onClick={() => setPoPayFromRegister(false)}
                >
                  {t('stock.po.otherMethod')}
                </button>
              </div>
            </div>

            {poPayFromRegister && poCart.length > 0 && (
              <div style={s.registerNote}>{t('stock.po.registerNote', { amount: poTotalCost.toFixed(2) })}</div>
            )}

            <button
              style={{ ...s.submitBtn, width: '100%', opacity: poCart.length === 0 ? 0.6 : 1 }}
              onClick={handleReviewPurchase}
              disabled={poCart.length === 0}
            >
              {t('stock.po.review')}
            </button>
          </div>
        </div>
      )}

      {tab === 'po' && poStep === 'review' && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>{t('stock.po.reviewTitle')}</h3>
          <p style={s.reviewRow}><strong>{t('stock.po.company')}:</strong> {poSelectedCompany ? `${poSelectedCompany.name} (${poSelectedCompany.code})` : t('stock.po.noCompany')}</p>

          <table style={s.poTable}>
            <thead>
              <tr style={s.poThead}>
                <th style={s.poTh}>{t('stock.col.product')}</th>
                <th style={s.poTh}>{t('stock.col.barcode')}</th>
                <th style={s.poTh}>{t('common.quantity')}</th>
                <th style={s.poTh}>{t('stock.buyingPrice')}</th>
                <th style={s.poTh}>{t('stock.sellingPrice')}</th>
                <th style={s.poTh}>{t('stock.po.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {poCart.map(line => {
                const unit = UNIT_LABELS[line.unitType] ?? 'pcs';
                return (
                  <tr key={line.productId} style={s.poTr}>
                    <td style={s.poTd}>{line.name}</td>
                    <td style={s.poTd}><code style={s.code}>{line.barcode}</code></td>
                    <td style={s.poTd}>{line.quantity} {unit}</td>
                    <td style={s.poTd}>{line.buyingPrice.toFixed(2)} ₾</td>
                    <td style={s.poTd}>{line.sellingPrice.toFixed(2)} ₾</td>
                    <td style={{ ...s.poTd, fontWeight: 600 }}>{(line.quantity * line.buyingPrice).toFixed(2)} ₾</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ ...s.totalRow, marginTop: 16 }}>
            <span>{t('stock.po.totalCost')}</span>
            <span>{poTotalCost.toFixed(2)} ₾</span>
          </div>

          <p style={s.reviewRow}>
            <strong>{t('stock.po.paymentMethod')}:</strong> {poPayFromRegister ? t('stock.po.fromRegister') : t('stock.po.otherMethod')}
          </p>
          {poPayFromRegister && (
            <div style={s.registerNote}>{t('stock.po.registerNote', { amount: poTotalCost.toFixed(2) })}</div>
          )}

          {poError && <div style={s.errorBox}>{poError}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button style={s.ghostBtn} type="button" onClick={() => setPoStep('cart')} disabled={poLoading}>
              {t('common.back')}
            </button>
            <button style={{ ...s.submitBtn, opacity: poLoading ? 0.7 : 1 }} onClick={handleConfirmPurchase} disabled={poLoading}>
              {poLoading ? t('stock.po.confirming') : t('stock.po.confirm')}
            </button>
          </div>
        </div>
      )}

      {tab === 'po' && poStep === 'done' && poResult && (
        <div style={s.card}>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={s.successIcon}>✓</div>
            <h3 style={{ margin: '14px 0 6px', fontSize: 18, fontWeight: 700, color: '#111827' }}>{t('stock.po.successTitle')}</h3>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: '#374151' }}>
              {t('stock.po.successSummary', { count: poResult.movements.length, amount: poResult.totalCost.toFixed(2) })}
            </p>
            {poResult.registerDebited && (
              <p style={{ margin: 0, fontSize: 13, color: '#B91C1C' }}>{t('stock.po.registerDebited', { amount: poResult.totalCost.toFixed(2) })}</p>
            )}
            <button style={{ ...s.submitBtn, marginTop: 20 }} onClick={resetPurchaseOrder}>
              {t('stock.po.newPurchase')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  pageHeader: { marginBottom: 20 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },

  tabBar: { display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F8', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: { padding: '7px 16px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#6B7280', fontWeight: 500 },
  activeTab: { background: '#fff', color: '#111827', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },

  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#111827' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  fourCol: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, background: '#F9FAFB', color: '#111827', boxSizing: 'border-box', width: '100%' },
  selectedBadge: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#065F46', background: '#D1FAE5', border: '1px solid #6EE7B7', padding: '8px 12px', borderRadius: 8 },
  successBox: { background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#065F46', fontWeight: 500 },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', fontWeight: 500 },
  submitBtn: { background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 15, alignSelf: 'flex-start' },
  ghostBtn: { background: '#F3F4F8', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 500, fontSize: 15 },

  tableHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' },
  sectionSub: { margin: '3px 0 0', fontSize: 12, color: '#9CA3AF' },
  searchInput: { padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, width: 260, background: '#fff', boxSizing: 'border-box' },

  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  code: { background: '#F3F4F8', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', color: '#6B7280' },
  typeBadge: { display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },

  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB' },
  pageBtn: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#374151' },
  pageInfo: { fontSize: 14, color: '#6B7280' },

  // Purchase Order
  poLayout: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  poLeft: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 },
  poRight: { width: 292, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB', position: 'sticky', top: 24 },
  emptyCart: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 15 },
  poTable: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  poThead: { background: '#F9FAFB' },
  poTh: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' },
  poTr: { borderBottom: '1px solid #F3F4F6' },
  poTd: { padding: '10px 12px', fontSize: 14, color: '#374151' },
  smallInput: { padding: '5px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 14, width: 80, boxSizing: 'border-box', background: '#F9FAFB' },
  removeBtn: { background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },

  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: 20, marginBottom: 16, color: '#111827' },
  payTypeSection: { marginBottom: 12 },
  payTypeLabel: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  payTypeRow: { display: 'flex', gap: 6 },
  payTypeBtn: { flex: 1, padding: '8px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  payTypeBtnActive: { background: '#DC2626', color: '#fff', borderColor: '#DC2626' },
  payTypeBtnOther: { background: '#059669', color: '#fff', borderColor: '#059669' },
  registerNote: { fontSize: 12, color: '#B91C1C', background: '#FEF2F2', padding: '6px 10px', borderRadius: 6, fontWeight: 500, marginBottom: 12 },

  reviewRow: { fontSize: 14, color: '#374151', margin: '0 0 14px' },
  successIcon: { width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5', color: '#059669', fontSize: 28, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
};
