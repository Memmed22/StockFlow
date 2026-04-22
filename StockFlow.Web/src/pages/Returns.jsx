import { useEffect, useState } from 'react';
import { returnsApi, customersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProductSearch from '../components/ProductSearch';

const UNIT_LABELS = { 0: 'pcs', 1: 'm', 2: 'm²', 3: 'L' };
const UNIT_IS_DECIMAL = { 0: false, 1: true, 2: true, 3: true };

export default function Returns() {
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [returnPrice, setReturnPrice] = useState('');
  const [note, setNote] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    customersApi.getAll().then(r => setCustomers(r.data)).catch(() => {});
  }, []);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phoneNumber.includes(customerSearch)
  );

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setReturnPrice(product.sellingPrice.toFixed(2));
    setQuantity('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedProduct) { setError('Please select a product.'); return; }
    const isDecimal = UNIT_IS_DECIMAL[selectedProduct.unitType ?? 0];
    const qty = isDecimal ? parseFloat(quantity) : parseInt(quantity);
    if (!qty || qty <= 0) { setError('Enter a valid quantity.'); return; }
    const price = parseFloat(returnPrice);
    if (isNaN(price) || price < 0) { setError('Return price must be 0 or greater.'); return; }
    try {
      await returnsApi.process({
        productId: selectedProduct.id,
        quantity: qty,
        basePrice: selectedProduct.sellingPrice,
        returnPrice: price,
        note: note || null,
        customerId: selectedCustomer?.id ?? null,
        userId: selectedCustomer ? user.id : 0,
      });
      const customerNote = selectedCustomer ? ` — removed from ${selectedCustomer.name}'s balance` : '';
      setSuccess(`Return processed. Stock updated.${customerNote}`);
      setSelectedProduct(null);
      setQuantity('');
      setReturnPrice('');
      setNote('');
      setSelectedCustomer(null);
      setCustomerSearch('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error processing return.');
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
        <h2 style={s.title}>Returns</h2>
        <p style={s.subtitle}>Process a customer return — stock will be restocked automatically</p>
      </div>

      <div style={s.card}>
        <form onSubmit={handleSubmit} style={s.form}>

          <div style={s.field}>
            <label style={s.label}>Product *</label>
            <ProductSearch onSelect={handleProductSelect} placeholder="Search by name or barcode..." />
            {selectedProduct && (
              <div style={s.selectedBadge}>
                <span>✓</span>
                <span><strong>{selectedProduct.name}</strong> — {selectedProduct.barcode} · Stock: <strong>{selectedProduct.stockQuantity} {unitLabel}</strong></span>
              </div>
            )}
          </div>

          <div style={s.twoCol}>
            <div style={s.field}>
              <label style={s.label}>Quantity{unitLabel ? ` (${unitLabel})` : ''} *</label>
              <input style={s.input} type="number"
                min={isDecimal ? '0.01' : '1'} step={isDecimal ? '0.01' : '1'}
                required placeholder={isDecimal ? 'e.g. 1.5' : 'e.g. 1'}
                value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>

            {selectedProduct && (
              <div style={s.field}>
                <label style={s.label}>
                  Return Price (₾)
                  {priceChanged && <span style={s.changedBadge}>modified</span>}
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...s.input, borderColor: priceChanged ? '#F59E0B' : '#E5E7EB' }}
                    type="number" min="0" step="0.01" required
                    value={returnPrice} onChange={e => setReturnPrice(e.target.value)} />
                  {priceChanged && (
                    <button type="button" style={s.resetBtn}
                      onClick={() => setReturnPrice(basePrice.toFixed(2))}>
                      Reset
                    </button>
                  )}
                </div>
                <span style={s.defaultHint}>Default: {basePrice.toFixed(2)} ₾</span>
              </div>
            )}
          </div>

          {selectedProduct && qty > 0 && (
            <div style={s.totalBox}>
              <span style={{ color: '#374151' }}>Return Total</span>
              <strong style={{ fontSize: 18, color: '#059669' }}>{returnTotal.toFixed(2)} ₾</strong>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{qty} × {price.toFixed(2)} ₾</span>
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>Note</label>
            <input style={s.input} placeholder="Reason for return (optional)"
              value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <div style={s.field}>
            <label style={s.label}>Link to Customer <span style={s.optional}>(optional — deducts from balance)</span></label>
            {selectedCustomer ? (
              <div style={s.customerSelected}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {selectedCustomer.phoneNumber} · Balance:&nbsp;
                    <span style={{ color: selectedCustomer.balance > 0 ? '#DC2626' : '#059669', fontWeight: 700 }}>
                      {selectedCustomer.balance.toFixed(2)} ₾
                    </span>
                  </div>
                </div>
                <button type="button" style={s.removeBtn}
                  onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}>
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input style={s.input} placeholder="Search customer by name or phone..."
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
            {selectedCustomer && qty > 0 && (
              <div style={s.debtNote}>Customer balance will decrease by {returnTotal.toFixed(2)} ₾</div>
            )}
          </div>

          {error && <div style={s.errorBox}>{error}</div>}
          {success && <div style={s.successBox}>{success}</div>}

          <button style={s.primaryBtn} type="submit">Process Return</button>
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
  debtNote: { fontSize: 12, color: '#059669', background: '#F0FDF4', padding: '5px 10px', borderRadius: 6, fontWeight: 500 },

  successBox: { background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#065F46', fontWeight: 500 },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', fontWeight: 500 },
  primaryBtn: { background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 15, alignSelf: 'flex-start' },
};
