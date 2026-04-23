import { useEffect, useRef, useState } from 'react';
import { salesApi, customersApi, cashClosingApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProductSearch from '../components/ProductSearch';

const UNIT_LABELS = { 0: 'pcs', 1: 'm', 2: 'm²', 3: 'L' };
const UNIT_IS_DECIMAL = { 0: false, 1: true, 2: true, 3: true };

function loadCart() {
  try { return JSON.parse(localStorage.getItem('pos_cart') || '[]'); } catch { return []; }
}
function saveCart(cart) { localStorage.setItem('pos_cart', JSON.stringify(cart)); }
function loadCartDiscount() { return parseFloat(localStorage.getItem('pos_cart_discount') || '0'); }
function saveCartDiscount(v) { localStorage.setItem('pos_cart_discount', String(v)); }

export default function POS() {
  const { user } = useAuth();
  const [cart, setCart] = useState(loadCart);
  const [cartDiscount, setCartDiscount] = useState(loadCartDiscount);
  const [saleType, setSaleType] = useState('cash');
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const searchRef = useRef();

  const [openingModal, setOpeningModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingError, setOpeningError] = useState('');
  const [openingLoading, setOpeningLoading] = useState(false);

  const [payModal, setPayModal] = useState(false);
  const [pmCustomers, setPmCustomers] = useState([]);
  const [pmSearch, setPmSearch] = useState('');
  const [pmCustomer, setPmCustomer] = useState(null);
  const [pmShowList, setPmShowList] = useState(false);
  const [pmAmount, setPmAmount] = useState('');
  const [pmError, setPmError] = useState('');
  const [pmSuccess, setPmSuccess] = useState('');
  const [pmLoading, setPmLoading] = useState(false);

  useEffect(() => {
    cashClosingApi.openingStatus()
      .then(r => { if (!r.data.hasOpeningCash) setOpeningModal(true); })
      .catch(() => {});
  }, []);

  useEffect(() => { saveCart(cart); }, [cart]);
  useEffect(() => { saveCartDiscount(cartDiscount); }, [cartDiscount]);
  useEffect(() => {
    if (saleType === 'debit' && customers.length === 0) {
      customersApi.getAll().then(r => setCustomers(r.data)).catch(() => {});
    }
  }, [saleType]);

  const openPayModal = () => {
    setPayModal(true);
    setPmCustomers([]); setPmSearch(''); setPmCustomer(null);
    setPmAmount(''); setPmError(''); setPmSuccess('');
    customersApi.getAll().then(r => setPmCustomers(r.data)).catch(() => {});
  };

  const closePayModal = () => { setPayModal(false); };

  const pmFiltered = pmCustomers.filter(c =>
    c.name.toLowerCase().includes(pmSearch.toLowerCase()) ||
    c.phoneNumber.includes(pmSearch)
  );

  const handleModalPayment = async (e) => {
    e.preventDefault();
    if (!pmCustomer) { setPmError('Select a customer.'); return; }
    const amount = parseFloat(pmAmount);
    if (!amount || amount <= 0) { setPmError('Enter a valid amount.'); return; }
    setPmError(''); setPmLoading(true);
    try {
      await customersApi.recordPayment(pmCustomer.id, { userId: user.id, amount });
      setPmSuccess(`Payment of ${amount.toFixed(2)} ₾ recorded for ${pmCustomer.name}.`);
      setPmCustomer(null); setPmSearch(''); setPmAmount('');
    } catch (err) {
      setPmError(err.response?.data?.error || 'Failed to record payment.');
    } finally { setPmLoading(false); }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phoneNumber.includes(customerSearch)
  );

  const subtotal = cart.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
  const total = Math.max(0, subtotal - cartDiscount);

  const handleProductSelected = (product) => {
    setError('');
    const existing = cart.find(i => i.productId === product.id);
    const alreadyInCart = existing ? existing.quantity : 0;
    if (product.stockQuantity <= 0) {
      setError(`${product.name} is out of stock.`);
    } else if (alreadyInCart >= product.stockQuantity) {
      setError(`Not enough stock for ${product.name}. Available: ${product.stockQuantity}`);
    } else {
      addToCart(product);
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id
          ? { ...i, quantity: i.quantity + 1, maxStock: product.stockQuantity }
          : i);
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        basePrice: product.sellingPrice,
        finalPrice: product.sellingPrice,
        discount: 0,
        quantity: 1,
        maxStock: product.stockQuantity,
        unitType: product.unitType ?? 0,
      }];
    });
  };

  const updateQty = (productId, rawVal) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;
    const isDecimal = UNIT_IS_DECIMAL[item.unitType];
    const qty = isDecimal ? parseFloat(rawVal) : parseInt(rawVal);
    if (!qty || qty <= 0) return;
    if (qty > item.maxStock) {
      setError(`Not enough stock for ${item.name}. Available: ${item.maxStock}`);
      return;
    }
    setError('');
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (productId, price) => {
    setCart(prev => prev.map(i => i.productId === productId
      ? { ...i, finalPrice: parseFloat(price) || 0 } : i));
  };

  const updateItemDiscount = (productId, discount) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const d = parseFloat(discount) || 0;
      return { ...i, discount: d, finalPrice: Math.max(0, i.basePrice - d) };
    }));
  };

  const removeItem = (productId) => setCart(prev => prev.filter(i => i.productId !== productId));

  const clearCart = () => {
    setCart([]); setCartDiscount(0); setError(''); setSuccess('');
    setSaleType('cash'); setSelectedCustomer(null); setCustomerSearch('');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { setError('Cart is empty.'); return; }
    if (saleType === 'debit' && !selectedCustomer) { setError('Select a customer for debit sale.'); return; }
    setError(''); setSuccess('');
    try {
      const payload = {
        userId: user.id,
        discountAmount: cartDiscount,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          finalPrice: i.finalPrice,
          discountAmount: i.discount,
        })),
        type: saleType === 'debit' ? 1 : 0,
        customerId: saleType === 'debit' ? selectedCustomer?.id : null,
      };
      const { data: sale } = await salesApi.create(payload);
      const customerNote = saleType === 'debit' ? ` — charged to ${selectedCustomer.name}` : '';
      setSuccess(`Sale #${sale.id} completed! Total: ${sale.totalAmount.toFixed(2)} ₾${customerNote}`);
      setCart([]); setCartDiscount(0);
      setSaleType('cash'); setSelectedCustomer(null); setCustomerSearch('');
      searchRef.current?.focus();
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed.');
    }
  };

  const handleOpeningSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) { setOpeningError('Enter a valid amount (0 or more).'); return; }
    setOpeningError(''); setOpeningLoading(true);
    try {
      await cashClosingApi.createOpening({ userId: user.id, amount });
      setOpeningModal(false);
    } catch (err) {
      setOpeningError(err.response?.data?.error || 'Failed to record opening cash.');
    } finally {
      setOpeningLoading(false);
    }
  };

  return (
    <div style={styles.root}>
      <div style={styles.left}>
        <h2 style={styles.title}>Point of Sale</h2>

        <div style={styles.searchRow}>
          <ProductSearch
            ref={searchRef}
            clearAfterSelect
            autoFocus
            onSelect={handleProductSelected}
            placeholder="Search by name or scan barcode..."
            inputStyle={styles.searchInput}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        {cart.length === 0 ? (
          <div style={styles.empty}>Cart is empty. Scan a product to start.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Product</th>
                <th style={styles.th}>Stock</th>
                <th style={styles.th}>Base Price</th>
                <th style={styles.th}>Discount</th>
                <th style={styles.th}>Final Price</th>
                <th style={styles.th}>Qty</th>
                <th style={styles.th}>Line Total</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => {
                const isDecimal = UNIT_IS_DECIMAL[item.unitType];
                const unit = UNIT_LABELS[item.unitType] ?? 'pcs';
                const stockWarn = item.quantity > item.maxStock;
                return (
                  <tr key={item.productId} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.barcode}</div>
                    </td>
                    <td style={{ ...styles.td, color: item.maxStock <= 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {item.maxStock} {unit}
                    </td>
                    <td style={styles.td}>{item.basePrice.toFixed(2)} ₾</td>
                    <td style={styles.td}>
                      <input type="number" step="0.01" min="0" style={styles.smallInput}
                        value={item.discount}
                        onChange={e => updateItemDiscount(item.productId, e.target.value)} />
                    </td>
                    <td style={styles.td}>
                      <input type="number" step="0.01" min="0" style={styles.smallInput}
                        value={item.finalPrice}
                        onChange={e => updatePrice(item.productId, e.target.value)} />
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          step={isDecimal ? '0.01' : '1'}
                          min={isDecimal ? '0.01' : '1'}
                          max={item.maxStock}
                          style={{ ...styles.smallInput, width: 70, borderColor: stockWarn ? '#dc2626' : '#e2e8f0' }}
                          value={item.quantity}
                          onChange={e => updateQty(item.productId, e.target.value)}
                        />
                        <span style={{ fontSize: 12, color: '#64748b' }}>{unit}</span>
                      </div>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>
                      {(item.finalPrice * item.quantity).toFixed(2)} ₾
                    </td>
                    <td style={styles.td}>
                      <button style={styles.removeBtn} onClick={() => removeItem(item.productId)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.right}>
        <h3 style={styles.summaryTitle}>Order Summary</h3>

        <div style={styles.summaryRow}>
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)} ₾</span>
        </div>
        <div style={styles.summaryRow}>
          <span>Cart Discount</span>
          <input type="number" step="0.01" min="0" style={{ ...styles.smallInput, width: 80 }}
            value={cartDiscount}
            onChange={e => setCartDiscount(parseFloat(e.target.value) || 0)} />
        </div>
        <div style={styles.totalRow}>
          <span>Total</span>
          <span>{total.toFixed(2)} ₾</span>
        </div>

        <div style={styles.payTypeSection}>
          <div style={styles.payTypeLabel}>Payment Type</div>
          <div style={styles.payTypeRow}>
            <button
              style={{ ...styles.payTypeBtn, ...(saleType === 'cash' ? styles.payTypeBtnActive : {}) }}
              onClick={() => { setSaleType('cash'); setSelectedCustomer(null); setCustomerSearch(''); }}
            >
              Cash
            </button>
            <button
              style={{ ...styles.payTypeBtn, ...(saleType === 'debit' ? styles.payTypeBtnDebit : {}) }}
              onClick={() => setSaleType('debit')}
            >
              Debit
            </button>
          </div>
        </div>

        {saleType === 'debit' && (
          <div style={styles.customerSection}>
            <div style={styles.payTypeLabel}>Customer *</div>
            {selectedCustomer ? (
              <div style={styles.selectedCustomer}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedCustomer.phoneNumber}</div>
                  <div style={{ fontSize: 12, color: selectedCustomer.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                    Balance: {selectedCustomer.balance.toFixed(2)} ₾
                  </div>
                </div>
                <button style={styles.changeBtn} onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}>
                  Change
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  style={styles.customerSearchInput}
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerList(true); }}
                  onFocus={() => setShowCustomerList(true)}
                  onBlur={() => setTimeout(() => setShowCustomerList(false), 150)}
                />
                {showCustomerList && filteredCustomers.length > 0 && (
                  <div style={styles.customerDropdown}>
                    {filteredCustomers.slice(0, 6).map(c => (
                      <div key={c.id} style={styles.customerItem}
                        onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerList(false); }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{c.phoneNumber}
                          &nbsp;·&nbsp;
                          <span style={{ color: c.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                            {c.balance.toFixed(2)} ₾
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {customers.length === 0 && (
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>Loading customers...</p>
                )}
              </div>
            )}
          </div>
        )}

        <button style={styles.checkoutBtn} onClick={handleCheckout} disabled={cart.length === 0}>
          {saleType === 'debit' ? 'Charge to Customer' : 'Checkout'}
        </button>
        <button style={styles.clearBtn} onClick={clearCart}>Clear Cart</button>
        <button style={styles.payModalBtn} onClick={openPayModal}>Customer Payment</button>
        {cart.length > 0 && (
          <p style={styles.cartHint}>{cart.length} item(s) — cart saved</p>
        )}
      </div>

      {openingModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={styles.openingIcon}>₾</div>
              <h3 style={{ margin: '12px 0 6px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
                Enter Opening Cash
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>
                Enter the starting cash amount in the register before beginning sales.
              </p>
            </div>
            <form onSubmit={handleOpeningSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={styles.modalLabel}>Opening Cash Amount (₾)</label>
                <input
                  style={{ ...styles.modalInput, fontSize: 20, fontWeight: 700, textAlign: 'center', padding: '12px' }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={openingAmount}
                  onChange={e => setOpeningAmount(e.target.value)}
                  autoFocus
                  required
                />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                  Enter 0 if no change money was provided
                </p>
              </div>
              {openingError && (
                <p style={{ color: '#B91C1C', margin: 0, fontSize: 13, background: '#FEE2E2', padding: '8px 12px', borderRadius: 6 }}>
                  {openingError}
                </p>
              )}
              <button
                style={{ ...styles.checkoutBtn, background: '#4F46E5', marginBottom: 0, opacity: openingLoading ? 0.7 : 1 }}
                type="submit"
                disabled={openingLoading}
              >
                {openingLoading ? 'Saving…' : 'Start Shift'}
              </button>
            </form>
          </div>
        </div>
      )}

      {payModal && (
        <div style={styles.overlay} onClick={e => e.target === e.currentTarget && closePayModal()}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Customer Payment</h3>
              <button style={styles.modalClose} onClick={closePayModal}>✕</button>
            </div>

            {pmSuccess ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <p style={{ color: '#16a34a', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>{pmSuccess}</p>
                <button style={styles.checkoutBtn} onClick={closePayModal}>Done</button>
              </div>
            ) : (
              <form onSubmit={handleModalPayment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={styles.modalLabel}>Customer *</label>
                  {pmCustomer ? (
                    <div style={styles.selectedCustomer}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{pmCustomer.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{pmCustomer.phoneNumber}
                          &nbsp;·&nbsp;
                          <span style={{ color: pmCustomer.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                            Balance: {pmCustomer.balance.toFixed(2)} ₾
                          </span>
                        </div>
                      </div>
                      <button type="button" style={styles.changeBtn} onClick={() => { setPmCustomer(null); setPmSearch(''); }}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        style={styles.modalInput}
                        placeholder="Search by name or phone..."
                        value={pmSearch}
                        onChange={e => { setPmSearch(e.target.value); setPmShowList(true); }}
                        onFocus={() => setPmShowList(true)}
                        onBlur={() => setTimeout(() => setPmShowList(false), 150)}
                        autoFocus
                      />
                      {pmShowList && pmFiltered.length > 0 && (
                        <div style={styles.customerDropdown}>
                          {pmFiltered.slice(0, 6).map(c => (
                            <div key={c.id} style={styles.customerItem}
                              onMouseDown={() => { setPmCustomer(c); setPmSearch(''); setPmShowList(false); }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{c.phoneNumber}
                                &nbsp;·&nbsp;
                                <span style={{ color: c.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                                  {c.balance.toFixed(2)} ₾
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label style={styles.modalLabel}>Amount (₾) *</label>
                  <input
                    style={styles.modalInput}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 50.00"
                    value={pmAmount}
                    onChange={e => setPmAmount(e.target.value)}
                  />
                </div>

                {pmError && <p style={{ color: '#dc2626', margin: 0, fontSize: 13 }}>{pmError}</p>}

                <button style={{ ...styles.checkoutBtn, background: '#2563eb', marginBottom: 0 }} type="submit" disabled={pmLoading}>
                  {pmLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  left: { flex: 1, minWidth: 0 },
  right: { width: 292, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB', position: 'sticky', top: 24 },
  title: { margin: '0 0 16px', fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  searchRow: { marginBottom: 14 },
  searchInput: { fontSize: 15, padding: '11px 14px' },
  error: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', color: '#B91C1C', fontSize: 13, fontWeight: 500, marginBottom: 10 },
  success: { background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '8px 12px', color: '#065F46', fontSize: 13, fontWeight: 600, marginBottom: 10 },
  empty: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 15 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  thead: { background: '#F9FAFB' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '10px 12px', fontSize: 14, color: '#374151' },
  smallInput: { padding: '5px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 14, width: 90, boxSizing: 'border-box', background: '#F9FAFB' },
  removeBtn: { background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  summaryTitle: { margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111827' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 14, color: '#374151' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 20, borderTop: '2px solid #E5E7EB', paddingTop: 12, marginTop: 8, marginBottom: 16, color: '#111827' },
  payTypeSection: { marginBottom: 12 },
  payTypeLabel: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  payTypeRow: { display: 'flex', gap: 6 },
  payTypeBtn: { flex: 1, padding: '8px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  payTypeBtnActive: { background: '#059669', color: '#fff', borderColor: '#059669' },
  payTypeBtnDebit: { background: '#DC2626', color: '#fff', borderColor: '#DC2626' },
  customerSection: { marginBottom: 14 },
  customerSearchInput: { width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', background: '#F9FAFB' },
  customerDropdown: { position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4 },
  customerItem: { padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' },
  selectedCustomer: { background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  changeBtn: { background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  checkoutBtn: { width: '100%', padding: 13, background: '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 8, marginTop: 4 },
  clearBtn: { width: '100%', padding: 9, background: '#F3F4F8', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 14 },
  cartHint: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', margin: '8px 0 0' },
  payModalBtn: { width: '100%', padding: 9, background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, marginTop: 6 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 14, padding: 28, width: 430, maxWidth: '95vw', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' },
  modalClose: { background: '#F3F4F8', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 16, cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalLabel: { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 },
  modalInput: { width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#F9FAFB' },
  openingIcon: { width: 56, height: 56, borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', fontSize: 24, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
};
