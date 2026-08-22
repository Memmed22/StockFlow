import { useEffect, useState } from 'react';
import { returnsApi, customersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProductSearch from '../components/ProductSearch';
import { useTranslation } from 'react-i18next';

const UNIT_LABELS = { 0: 'pcs', 1: 'm', 2: 'm²', 3: 'L' };
const UNIT_IS_DECIMAL = { 0: false, 1: true, 2: true, 3: true };

export default function Returns() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [returnPrice, setReturnPrice] = useState('');
  const [note, setNote] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [purchaseCheck, setPurchaseCheck] = useState(null);
  const [refundMethod, setRefundMethod] = useState('cash');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { customersApi.getAll().then(r => setCustomers(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedCustomer || !selectedProduct) return;
    let cancelled = false;
    customersApi.hasPurchased(selectedCustomer.id, selectedProduct.id)
      .then(r => {
        if (cancelled) return;
        setPurchaseCheck({ customerId: selectedCustomer.id, productId: selectedProduct.id, purchased: r.data.purchased });
        if (r.data.purchased && r.data.lastPrice != null) setReturnPrice(r.data.lastPrice.toFixed(2));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedCustomer, selectedProduct]);

  const neverPurchased = !!selectedCustomer && !!selectedProduct
    && purchaseCheck?.customerId === selectedCustomer.id
    && purchaseCheck?.productId === selectedProduct.id
    && !purchaseCheck.purchased;

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phoneNumber.includes(customerSearch)
  );

  const handleProductSelect = (product) => {
    setSelectedProduct(product); setReturnPrice(product.sellingPrice.toFixed(2));
    setQuantity(''); setError(''); setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(''); setSuccess('');
    if (!selectedProduct) { setError(t('returns.errors.selectProduct')); return; }
    const isDecimal = UNIT_IS_DECIMAL[selectedProduct.unitType ?? 0];
    const qty = isDecimal ? parseFloat(quantity) : parseInt(quantity);
    if (!qty || qty <= 0) { setError(t('returns.errors.quantity')); return; }
    const price = parseFloat(returnPrice);
    if (isNaN(price) || price < 0) { setError(t('returns.errors.price')); return; }
    setSubmitting(true);
    try {
      await returnsApi.process({
        productId: selectedProduct.id, quantity: qty, basePrice: selectedProduct.sellingPrice, returnPrice: price,
        note: note || null, customerId: selectedCustomer?.id ?? null, userId: user.id,
        settleAsCredit: !!selectedCustomer && refundMethod === 'credit',
      });
      const customerNote = selectedCustomer ? ` — ${selectedCustomer.name}` : '';
      setSuccess(`${t('returns.returnTotal')}: ${(qty * price).toFixed(2)} ₾${customerNote}`);
      setSelectedProduct(null); setQuantity(''); setReturnPrice(''); setNote('');
      setSelectedCustomer(null); setCustomerSearch(''); setRefundMethod('cash');
    } catch (err) {
      setError(err.response?.data?.error || t('returns.errors.processing'));
    } finally {
      setSubmitting(false);
    }
  };

  const isDecimal = UNIT_IS_DECIMAL[selectedProduct?.unitType ?? 0];
  const unitLabel = selectedProduct ? UNIT_LABELS[selectedProduct.unitType ?? 0] : '';
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(returnPrice) || 0;
  const returnTotal = qty * price;
  const basePrice = selectedProduct?.sellingPrice ?? 0;
  const priceChanged = selectedProduct && parseFloat(returnPrice) !== basePrice;

  return (
    <div>
      <div style={s.pageHeader}>
        <h2 style={s.title}>{t('returns.title')}</h2>
        <p style={s.subtitle}>{t('returns.subtitle')}</p>
      </div>

      <div style={s.card}>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>{t('returns.product')}</label>
            <ProductSearch onSelect={handleProductSelect} placeholder={t('returns.searchPlaceholder')} />
            {selectedProduct && (
              <div style={s.selectedBadge}>
                <span>✓</span>
                <span><strong>{selectedProduct.name}</strong> — {selectedProduct.barcode} · {t('returns.currentStock')}: <strong>{selectedProduct.stockQuantity} {unitLabel}</strong></span>
              </div>
            )}
          </div>

          <div style={s.twoCol}>
            <div style={s.field}>
              <label style={s.label}>{t('returns.quantity')}{unitLabel ? ` (${unitLabel})` : ''} *</label>
              <input
                style={{ ...s.input, borderColor: quantity.trim() === '' ? '#DC2626' : '#E5E7EB' }}
                type="text" inputMode={isDecimal ? 'decimal' : 'numeric'}
                required placeholder={isDecimal ? 'e.g. 1.5' : 'e.g. 1'}
                value={quantity}
                onChange={e => {
                  const v = e.target.value;
                  if (isDecimal ? /^\d*\.?\d*$/.test(v) : /^\d*$/.test(v)) setQuantity(v);
                }}
              />
            </div>
            {selectedProduct && (
              <div style={s.field}>
                <label style={s.label}>
                  {t('returns.returnPrice')}
                  {priceChanged && <span style={s.changedBadge}>{t('returns.modified')}</span>}
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...s.input, borderColor: priceChanged ? '#F59E0B' : '#E5E7EB' }}
                    type="number" min="0" step="0.01" required
                    value={returnPrice} onChange={e => setReturnPrice(e.target.value)} />
                  {priceChanged && (
                    <button type="button" style={s.resetBtn} onClick={() => setReturnPrice(basePrice.toFixed(2))}>
                      {t('returns.reset')}
                    </button>
                  )}
                </div>
                <span style={s.defaultHint}>{t('returns.defaultPrice', { price: basePrice.toFixed(2) })}</span>
              </div>
            )}
          </div>

          {selectedProduct && qty > 0 && (
            <div style={s.totalBox}>
              <span style={{ color: '#374151' }}>{t('returns.returnTotal')}</span>
              <strong style={{ fontSize: 18, color: '#059669' }}>{returnTotal.toFixed(2)} ₾</strong>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{qty} × {price.toFixed(2)} ₾</span>
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>{t('returns.note')}</label>
            <input style={s.input} placeholder={t('returns.notePlaceholder')} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <div style={s.field}>
            <label style={s.label}>{t('returns.linkCustomer')} <span style={s.optional}>{t('returns.linkCustomerNote')}</span></label>
            {selectedCustomer ? (
              <div style={s.customerSelected}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {selectedCustomer.phoneNumber} · Balance:&nbsp;
                    <span style={{ color: selectedCustomer.balance > 0 ? '#DC2626' : '#059669', fontWeight: 700 }}>{selectedCustomer.balance.toFixed(2)} ₾</span>
                  </div>
                </div>
                <button type="button" style={s.removeBtn} onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setRefundMethod('cash'); }}>{t('returns.remove')}</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input style={s.input} placeholder={t('returns.searchCustomer')}
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerList(true); }}
                  onFocus={() => setShowCustomerList(true)}
                  onBlur={() => setTimeout(() => setShowCustomerList(false), 150)} />
                {showCustomerList && filteredCustomers.length > 0 && (
                  <div style={s.dropdown}>
                    {filteredCustomers.slice(0, 6).map(c => (
                      <div key={c.id} style={s.dropdownItem}
                        onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerList(false); }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{c.phoneNumber} ·&nbsp;
                          <span style={{ color: c.balance > 0 ? '#DC2626' : '#059669', fontWeight: 700 }}>{c.balance.toFixed(2)} ₾</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {selectedCustomer && (
              <div style={s.refundMethodBox}>
                <span style={s.label}>{t('returns.refundMethod')}</span>
                <div style={s.refundOptions}>
                  <label style={{ ...s.refundOption, ...(refundMethod === 'cash' ? s.refundOptionActive : {}) }}>
                    <input type="radio" name="refundMethod" checked={refundMethod === 'cash'}
                      onChange={() => setRefundMethod('cash')} style={{ marginRight: 6 }} />
                    {t('returns.refundCash')}
                  </label>
                  <label style={{ ...s.refundOption, ...(refundMethod === 'credit' ? s.refundOptionActive : {}) }}>
                    <input type="radio" name="refundMethod" checked={refundMethod === 'credit'}
                      onChange={() => setRefundMethod('credit')} style={{ marginRight: 6 }} />
                    {t('returns.refundCredit')}
                  </label>
                </div>
              </div>
            )}
            {selectedCustomer && qty > 0 && refundMethod === 'cash' && (
              <div style={s.cashNote}>{t('returns.cashRefundNote', { amount: returnTotal.toFixed(2) })}</div>
            )}
            {selectedCustomer && qty > 0 && refundMethod === 'credit' && (
              <div style={s.debtNote}>{t('returns.deductNote', { amount: returnTotal.toFixed(2) })}</div>
            )}
            {selectedCustomer && neverPurchased && (
              <div style={s.warningNote}>{t('returns.neverPurchasedWarning')}</div>
            )}
          </div>

          {error && <div style={s.errorBox}>{error}</div>}
          {success && <div style={s.successBox}>{success}</div>}
          <button style={{ ...s.primaryBtn, opacity: submitting ? 0.7 : 1 }} type="submit" disabled={submitting}>
            {submitting ? t('returns.processing') : t('returns.processReturn')}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  pageHeader: { marginBottom: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },
  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 28, maxWidth: 620, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 },
  optional: { fontSize: 11, color: '#9CA3AF', fontWeight: 400 },
  input: { padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, background: '#F9FAFB', color: '#111827', boxSizing: 'border-box', width: '100%' },
  selectedBadge: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#065F46', background: '#D1FAE5', border: '1px solid #6EE7B7', padding: '8px 12px', borderRadius: 8 },
  changedBadge: { background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10, border: '1px solid #FDE68A' },
  resetBtn: { background: '#F3F4F8', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 },
  defaultHint: { fontSize: 12, color: '#9CA3AF' },
  totalBox: { display: 'flex', alignItems: 'center', gap: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px' },
  customerSelected: { background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  removeBtn: { background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  dropdown: { position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 220, overflowY: 'auto', marginTop: 4 },
  dropdownItem: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' },
  refundMethodBox: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  refundOptions: { display: 'flex', gap: 8 },
  refundOption: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer', background: '#F9FAFB' },
  refundOptionActive: { borderColor: '#D97706', background: '#FFFBEB', color: '#92400E', fontWeight: 700 },
  cashNote: { fontSize: 12, color: '#B91C1C', background: '#FEF2F2', padding: '5px 10px', borderRadius: 6, fontWeight: 500 },
  debtNote: { fontSize: 12, color: '#059669', background: '#F0FDF4', padding: '5px 10px', borderRadius: 6, fontWeight: 500 },
  warningNote: { fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '5px 10px', borderRadius: 6, fontWeight: 500 },
  successBox: { background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#065F46', fontWeight: 500 },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', fontWeight: 500 },
  primaryBtn: { background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 15, alignSelf: 'flex-start' },
};
