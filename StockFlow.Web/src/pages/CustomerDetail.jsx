import { Fragment, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi, salesApi, returnsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProductSearch from '../components/ProductSearch';
import { useTranslation } from 'react-i18next';

const TYPE_COLORS = { CashSale: '#2563eb', DebitSale: '#dc2626', Return: '#d97706', CreditReturn: '#7c3aed', Payment: '#16a34a' };
const UNIT_LABELS = { 0: 'pcs', 1: 'm', 2: 'm²', 3: 'L' };
const UNIT_IS_DECIMAL = { 0: false, 1: true, 2: true, 3: true };

export default function CustomerDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('overview');
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [saleCart, setSaleCart] = useState([]);
  const [saleType, setSaleType] = useState('debit');
  const [saleQtyDrafts, setSaleQtyDrafts] = useState({});
  const [saleDiscountDrafts, setSaleDiscountDrafts] = useState({});
  const [salePriceDrafts, setSalePriceDrafts] = useState({});
  const [saleError, setSaleError] = useState('');
  const [saleSuccess, setSaleSuccess] = useState('');
  const [saleLoading, setSaleLoading] = useState(false);
  const saleSearchRef = useRef();

  const [returnCart, setReturnCart] = useState([]);
  const [returnQtyDrafts, setReturnQtyDrafts] = useState({});
  const [returnPriceDrafts, setReturnPriceDrafts] = useState({});
  const [refundMethod, setRefundMethod] = useState('cash');
  const [returnError, setReturnError] = useState('');
  const [returnSuccess, setReturnSuccess] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const returnSearchRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.getById(id);
      setDetail(data);
    } catch { navigate('/customers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handlePayment = async (e) => {
    e.preventDefault();
    setPayError(''); setPaySuccess('');
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setPayError(t('customerDetail.payment.errorInvalid')); return; }
    try {
      await customersApi.recordPayment(id, { userId: user.id, amount });
      setPaySuccess(t('customerDetail.payment.success', { amount: amount.toFixed(2) }));
      setPayAmount('');
      load();
    } catch (err) {
      setPayError(err.response?.data?.error || t('customerDetail.payment.errorFailed'));
    }
  };

  const handleDelete = async () => {
    setDeleteError(''); setDeleteLoading(true);
    try {
      await customersApi.delete(id);
      navigate('/customers');
    } catch (err) {
      setDeleteError(err.response?.data?.error || t('common.error'));
      setDeleteLoading(false);
    }
  };

  const toggleExpand = (txId) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(txId) ? next.delete(txId) : next.add(txId);
      return next;
    });
  };

  // ---- New Sale tab ----

  const handleSaleProductSelected = (product) => {
    setSaleError('');
    const existing = saleCart.find(i => i.productId === product.id);
    const alreadyInCart = existing ? existing.quantity : 0;
    if (product.stockQuantity <= 0) {
      setSaleError(`${product.name}: ${t('customerDetail.newSale.outOfStock')}`);
      return;
    }
    if (alreadyInCart >= product.stockQuantity) {
      setSaleError(`${product.name}: ${t('customerDetail.newSale.notEnoughStock', { available: product.stockQuantity })}`);
      return;
    }
    setSaleCart(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) {
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

  const handleSaleQtyChange = (productId, rawVal) => {
    const item = saleCart.find(i => i.productId === productId);
    if (!item) return;
    const isDecimal = UNIT_IS_DECIMAL[item.unitType];
    if (!(isDecimal ? /^\d*\.?\d*$/.test(rawVal) : /^\d*$/.test(rawVal))) return;

    setSaleQtyDrafts(prev => ({ ...prev, [productId]: rawVal }));

    const qty = isDecimal ? parseFloat(rawVal) : parseInt(rawVal, 10);
    if (!qty || qty <= 0) return;
    if (qty > item.maxStock) {
      setSaleError(`${item.name}: ${t('customerDetail.newSale.notEnoughStock', { available: item.maxStock })}`);
      return;
    }
    setSaleError('');
    setSaleCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  const handleSaleQtyBlur = (productId) => {
    setSaleQtyDrafts(prev => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleSalePriceChange = (productId, rawVal) => {
    if (!/^\d*\.?\d*$/.test(rawVal)) return;
    setSalePriceDrafts(prev => ({ ...prev, [productId]: rawVal }));
    if (rawVal === '' || rawVal === '.') return;
    const price = parseFloat(rawVal);
    setSaleCart(prev => prev.map(i => i.productId === productId ? { ...i, finalPrice: price } : i));
  };

  const handleSalePriceBlur = (productId) => {
    setSalePriceDrafts(prev => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleSaleDiscountChange = (productId, rawVal) => {
    if (!/^\d*\.?\d*$/.test(rawVal)) return;
    setSaleDiscountDrafts(prev => ({ ...prev, [productId]: rawVal }));
    if (rawVal === '' || rawVal === '.') return;
    const d = Math.min(100, Math.max(0, parseFloat(rawVal)));
    setSaleCart(prev => prev.map(i => i.productId === productId
      ? { ...i, discount: d, finalPrice: Math.max(0, i.basePrice * (1 - d / 100)) }
      : i));
  };

  const handleSaleDiscountBlur = (productId) => {
    setSaleDiscountDrafts(prev => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const removeSaleItem = (productId) => setSaleCart(prev => prev.filter(i => i.productId !== productId));

  const resetSaleCart = () => {
    setSaleCart([]); setSaleQtyDrafts({}); setSaleDiscountDrafts({}); setSalePriceDrafts({});
    setSaleError(''); setSaleSuccess('');
  };

  const saleTotal = saleCart.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);

  const handleSaleCheckout = async () => {
    if (saleCart.length === 0) { setSaleError(t('customerDetail.newSale.errorEmpty')); return; }
    setSaleError(''); setSaleSuccess(''); setSaleLoading(true);
    try {
      await salesApi.create({
        userId: user.id,
        discountAmount: 0,
        items: saleCart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          finalPrice: i.finalPrice,
          discountAmount: i.basePrice * i.discount / 100,
        })),
        type: saleType === 'debit' ? 1 : 0,
        customerId: Number(id),
      });
      setSaleSuccess(t('customerDetail.newSale.success', { amount: saleTotal.toFixed(2) }));
      setSaleCart([]); setSaleQtyDrafts({}); setSaleDiscountDrafts({}); setSalePriceDrafts({});
      saleSearchRef.current?.focus();
      load();
    } catch (err) {
      setSaleError(err.response?.data?.error || t('common.error'));
    } finally {
      setSaleLoading(false);
    }
  };

  // ---- New Return tab ----

  const handleReturnProductSelected = (product) => {
    setReturnError('');
    const alreadyPresent = returnCart.some(l => l.productId === product.id);
    setReturnCart(prev => {
      const existing = prev.find(l => l.productId === product.id);
      if (existing) return prev.map(l => l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        unitType: product.unitType ?? 0,
        quantity: 1,
        returnPrice: product.sellingPrice,
        basePrice: product.sellingPrice,
        neverPurchased: false,
        checked: false,
      }];
    });
    if (!alreadyPresent) {
      customersApi.hasPurchased(id, product.id).then(({ data }) => {
        setReturnCart(prev => prev.map(l => l.productId === product.id
          ? {
            ...l,
            checked: true,
            neverPurchased: !data.purchased,
            returnPrice: data.purchased && data.lastPrice != null ? data.lastPrice : l.returnPrice,
          }
          : l));
      }).catch(() => {});
    }
  };

  const handleReturnQtyChange = (productId, rawVal) => {
    const item = returnCart.find(l => l.productId === productId);
    if (!item) return;
    const isDecimal = UNIT_IS_DECIMAL[item.unitType];
    if (!(isDecimal ? /^\d*\.?\d*$/.test(rawVal) : /^\d*$/.test(rawVal))) return;

    setReturnQtyDrafts(prev => ({ ...prev, [productId]: rawVal }));

    const qty = isDecimal ? parseFloat(rawVal) : parseInt(rawVal, 10);
    if (!qty || qty <= 0) return;
    setReturnCart(prev => prev.map(l => l.productId === productId ? { ...l, quantity: qty } : l));
  };

  const handleReturnQtyBlur = (productId) => {
    setReturnQtyDrafts(prev => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleReturnPriceChange = (productId, rawVal) => {
    if (!/^\d*\.?\d*$/.test(rawVal)) return;
    setReturnPriceDrafts(prev => ({ ...prev, [productId]: rawVal }));
    if (rawVal === '' || rawVal === '.') return;
    const price = parseFloat(rawVal);
    setReturnCart(prev => prev.map(l => l.productId === productId ? { ...l, returnPrice: price } : l));
  };

  const handleReturnPriceBlur = (productId) => {
    setReturnPriceDrafts(prev => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const resetReturnLinePrice = (productId) => {
    setReturnCart(prev => prev.map(l => l.productId === productId ? { ...l, returnPrice: l.basePrice } : l));
    setReturnPriceDrafts(prev => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const removeReturnLine = (productId) => setReturnCart(prev => prev.filter(l => l.productId !== productId));

  const resetReturnCart = () => {
    setReturnCart([]); setReturnQtyDrafts({}); setReturnPriceDrafts({});
    setReturnError(''); setReturnSuccess(''); setRefundMethod('cash');
  };

  const returnTotal = returnCart.reduce((sum, l) => sum + l.quantity * l.returnPrice, 0);

  const handleProcessReturn = async () => {
    if (returnCart.length === 0) { setReturnError(t('customerDetail.newReturn.errorEmpty')); return; }
    setReturnError(''); setReturnSuccess(''); setReturnLoading(true);
    try {
      await returnsApi.processBulk({
        items: returnCart.map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          basePrice: l.basePrice,
          returnPrice: l.returnPrice,
          note: null,
        })),
        customerId: Number(id),
        userId: user.id,
        settleAsCredit: refundMethod === 'credit',
      });
      setReturnSuccess(t('customerDetail.newReturn.success', { amount: returnTotal.toFixed(2) }));
      setReturnCart([]); setReturnQtyDrafts({}); setReturnPriceDrafts({}); setRefundMethod('cash');
      returnSearchRef.current?.focus();
      load();
    } catch (err) {
      setReturnError(err.response?.data?.error || t('common.error'));
    } finally {
      setReturnLoading(false);
    }
  };

  if (loading) return <p style={{ color: '#64748b' }}>{t('customerDetail.loading')}</p>;
  if (!detail) return null;

  const { info, transactions } = detail;
  const balance = info.balance;

  return (
    <div>
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate('/customers')}>{t('customerDetail.back')}</button>
        <button style={styles.deleteBtn} onClick={() => setDeleteModal(true)}>{t('customerDetail.deleteModal.trigger')}</button>
      </div>

      <div style={styles.topRow}>
        <div style={styles.infoCard}>
          <h2 style={styles.customerName}>{info.name}</h2>
          <p style={styles.phone}>{info.phoneNumber}</p>
          {info.description && <p style={styles.description}>{info.description}</p>}
          <div style={{ ...styles.balanceBox, borderColor: balance > 0 ? '#fca5a5' : '#86efac', background: balance > 0 ? '#fef2f2' : '#f0fdf4' }}>
            <span style={styles.balanceLabel}>{t('customerDetail.balance')}</span>
            <span style={{ ...styles.balanceAmount, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
              {balance.toFixed(2)} ₾
            </span>
          </div>
        </div>

        {tab === 'overview' && (
          <div style={styles.payCard}>
            <h3 style={styles.payTitle}>{t('customerDetail.payment.title')}</h3>
            <form onSubmit={handlePayment} style={styles.payForm}>
              <label style={styles.label}>{t('customerDetail.payment.amount')}</label>
              <input
                style={styles.input}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 50"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
              />
              {payError && <p style={styles.error}>{payError}</p>}
              {paySuccess && <p style={styles.success}>{paySuccess}</p>}
              <button style={styles.payBtn} type="submit">{t('customerDetail.payment.button')}</button>
            </form>
          </div>
        )}
      </div>

      <div style={styles.tabBar}>
        {['overview', 'newSale', 'newReturn'].map(key => (
          <button key={key}
            style={{ ...styles.tab, ...(tab === key ? styles.activeTab : {}) }}
            onClick={() => setTab(key)}>
            {t(`customerDetail.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <h3 style={styles.sectionTitle}>{t('customerDetail.history')}</h3>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={{ ...styles.th, width: 28 }}></th>
                <th style={styles.th}>{t('customerDetail.col.date')}</th>
                <th style={styles.th}>{t('customerDetail.col.type')}</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>{t('customerDetail.col.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const isPositive = tx.amount > 0 && tx.type !== 'DebitSale';
                const hasItems = tx.items && tx.items.length > 0;
                const isOpen = expanded.has(tx.id);
                return (
                  <Fragment key={tx.id}>
                    <tr style={{ ...styles.tr, cursor: hasItems ? 'pointer' : 'default' }}
                      onClick={() => hasItems && toggleExpand(tx.id)}>
                      <td style={{ ...styles.td, color: '#94a3b8', fontSize: 12, paddingRight: 0 }}>
                        {hasItems ? (isOpen ? '▾' : '▸') : ''}
                      </td>
                      <td style={styles.td}>{new Date(tx.createdAt).toLocaleString()}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.typeBadge, background: (TYPE_COLORS[tx.type] ?? '#475569') + '22', color: TYPE_COLORS[tx.type] ?? '#475569' }}>
                          {t(`customerDetail.types.${tx.type}`) ?? tx.type}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: TYPE_COLORS[tx.type] ?? (isPositive ? '#dc2626' : '#16a34a') }}>
                        {isPositive ? '+' : ''}{tx.amount.toFixed(2)} ₾
                      </td>
                    </tr>
                    {hasItems && isOpen && (
                      <tr key={`${tx.id}-items`} style={{ background: '#f8fafc' }}>
                        <td colSpan={4} style={{ padding: '0 0 8px 44px' }}>
                          <table style={styles.itemsTable}>
                            <thead>
                              <tr>
                                <th style={styles.itemTh}>{t('customerDetail.items.product')}</th>
                                <th style={styles.itemTh}>{t('customerDetail.items.barcode')}</th>
                                <th style={styles.itemTh}>{t('customerDetail.items.qty')}</th>
                                <th style={styles.itemTh}>{t('customerDetail.items.unitPrice')}</th>
                                <th style={{ ...styles.itemTh, textAlign: 'right' }}>{t('customerDetail.items.total')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tx.items.map((item, idx) => (
                                <tr key={idx}>
                                  <td style={styles.itemTd}>{item.productName}</td>
                                  <td style={styles.itemTd}>{item.barcode ? <code style={styles.code}>{item.barcode}</code> : '—'}</td>
                                  <td style={styles.itemTd}>{item.quantity}</td>
                                  <td style={styles.itemTd}>{item.unitPrice.toFixed(2)} ₾</td>
                                  <td style={{ ...styles.itemTd, textAlign: 'right', fontWeight: 600 }}>{item.total.toFixed(2)} ₾</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan={4} style={styles.empty}>{t('customerDetail.noTransactions')}</td></tr>
              )}
            </tbody>
            {transactions.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={3} style={{ ...styles.td, fontWeight: 700 }}>{t('customerDetail.netBalance')}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontSize: 16, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                    {balance.toFixed(2)} ₾
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </>
      )}

      {tab === 'newSale' && (
        <div style={styles.cartLayout}>
          <div style={styles.cartLeft}>
            <ProductSearch
              ref={saleSearchRef}
              clearAfterSelect
              autoFocus
              onSelect={handleSaleProductSelected}
              placeholder={t('customerDetail.newSale.searchPlaceholder')}
            />
            {saleError && <p style={styles.error}>{saleError}</p>}
            {saleCart.length === 0 ? (
              <div style={styles.emptyCart}>{t('customerDetail.newSale.cartEmpty')}</div>
            ) : (
              <table style={styles.cartTable}>
                <thead>
                  <tr style={styles.cartThead}>
                    <th style={styles.cartTh}>{t('customerDetail.newSale.col.product')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newSale.col.stock')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newSale.col.basePrice')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newSale.col.discount')} (%)</th>
                    <th style={styles.cartTh}>{t('customerDetail.newSale.col.finalPrice')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newSale.col.qty')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newSale.col.lineTotal')}</th>
                    <th style={styles.cartTh}></th>
                  </tr>
                </thead>
                <tbody>
                  {saleCart.map(item => {
                    const isDecimal = UNIT_IS_DECIMAL[item.unitType];
                    const unit = UNIT_LABELS[item.unitType] ?? 'pcs';
                    const stockWarn = item.quantity > item.maxStock;
                    const qtyDraft = saleQtyDrafts[item.productId];
                    const qtyEmpty = qtyDraft !== undefined && qtyDraft.trim() === '';
                    const discountDraft = saleDiscountDrafts[item.productId];
                    const discountEmpty = discountDraft !== undefined && discountDraft.trim() === '';
                    const priceDraft = salePriceDrafts[item.productId];
                    const priceEmpty = priceDraft !== undefined && priceDraft.trim() === '';
                    return (
                      <tr key={item.productId} style={styles.cartTr}>
                        <td style={styles.cartTd}>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.barcode}</div>
                        </td>
                        <td style={{ ...styles.cartTd, color: item.maxStock <= 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                          {item.maxStock} {unit}
                        </td>
                        <td style={styles.cartTd}>{item.basePrice.toFixed(2)} ₾</td>
                        <td style={styles.cartTd}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              style={{ ...styles.smallInput, borderColor: discountEmpty ? '#dc2626' : '#e2e8f0' }}
                              value={discountDraft ?? item.discount}
                              onChange={e => handleSaleDiscountChange(item.productId, e.target.value)}
                              onBlur={() => handleSaleDiscountBlur(item.productId)}
                            />
                            <span style={{ fontSize: 12, color: '#64748b' }}>%</span>
                          </div>
                        </td>
                        <td style={styles.cartTd}>
                          <input
                            type="text"
                            inputMode="decimal"
                            style={{ ...styles.smallInput, borderColor: priceEmpty ? '#dc2626' : '#e2e8f0' }}
                            value={priceDraft ?? item.finalPrice}
                            onChange={e => handleSalePriceChange(item.productId, e.target.value)}
                            onBlur={() => handleSalePriceBlur(item.productId)}
                          />
                        </td>
                        <td style={styles.cartTd}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="text"
                              inputMode={isDecimal ? 'decimal' : 'numeric'}
                              style={{ ...styles.smallInput, width: 70, borderColor: (stockWarn || qtyEmpty) ? '#dc2626' : '#e2e8f0' }}
                              value={qtyDraft ?? item.quantity}
                              onChange={e => handleSaleQtyChange(item.productId, e.target.value)}
                              onBlur={() => handleSaleQtyBlur(item.productId)}
                            />
                            <span style={{ fontSize: 12, color: '#64748b' }}>{unit}</span>
                          </div>
                        </td>
                        <td style={{ ...styles.cartTd, fontWeight: 600 }}>
                          {(item.finalPrice * item.quantity).toFixed(2)} ₾
                        </td>
                        <td style={styles.cartTd}>
                          <button style={styles.removeBtn} onClick={() => removeSaleItem(item.productId)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={styles.cartRight}>
            <div style={styles.totalRow}>
              <span>{t('customerDetail.newSale.total')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{saleTotal.toFixed(2)} ₾</span>
                <button type="button" style={styles.resetLink} onClick={resetSaleCart}>{t('customerDetail.newSale.reset')}</button>
              </div>
            </div>

            <div style={styles.payTypeSection}>
              <div style={styles.payTypeLabel}>{t('customerDetail.newSale.paymentType')}</div>
              <div style={styles.payTypeRow}>
                <button
                  style={{ ...styles.payTypeBtn, ...(saleType === 'cash' ? styles.payTypeBtnActive : {}) }}
                  onClick={() => setSaleType('cash')}
                >
                  {t('customerDetail.newSale.cash')}
                </button>
                <button
                  style={{ ...styles.payTypeBtn, ...(saleType === 'debit' ? styles.payTypeBtnDebit : {}) }}
                  onClick={() => setSaleType('debit')}
                >
                  {t('customerDetail.newSale.debit')}
                </button>
              </div>
            </div>

            {saleSuccess && <p style={styles.success}>{saleSuccess}</p>}

            <button
              style={{ ...styles.checkoutBtn, opacity: saleLoading || saleCart.length === 0 ? 0.7 : 1 }}
              onClick={handleSaleCheckout}
              disabled={saleLoading || saleCart.length === 0}
            >
              {saleLoading ? t('customerDetail.newSale.processing') : t('customerDetail.newSale.checkout')}
            </button>
          </div>
        </div>
      )}

      {tab === 'newReturn' && (
        <div style={styles.cartLayout}>
          <div style={styles.cartLeft}>
            <ProductSearch
              ref={returnSearchRef}
              clearAfterSelect
              autoFocus
              onSelect={handleReturnProductSelected}
              placeholder={t('customerDetail.newReturn.searchPlaceholder')}
            />
            {returnError && <p style={styles.error}>{returnError}</p>}
            {returnCart.length === 0 ? (
              <div style={styles.emptyCart}>{t('customerDetail.newReturn.cartEmpty')}</div>
            ) : (
              <table style={styles.cartTable}>
                <thead>
                  <tr style={styles.cartThead}>
                    <th style={styles.cartTh}>{t('customerDetail.newReturn.col.product')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newReturn.col.barcode')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newReturn.col.qty')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newReturn.col.returnPrice')}</th>
                    <th style={styles.cartTh}>{t('customerDetail.newReturn.col.lineTotal')}</th>
                    <th style={styles.cartTh}></th>
                  </tr>
                </thead>
                <tbody>
                  {returnCart.map(line => {
                    const isDecimal = UNIT_IS_DECIMAL[line.unitType];
                    const unit = UNIT_LABELS[line.unitType] ?? 'pcs';
                    const qtyDraft = returnQtyDrafts[line.productId];
                    const qtyEmpty = qtyDraft !== undefined && qtyDraft.trim() === '';
                    const priceDraft = returnPriceDrafts[line.productId];
                    const priceChanged = line.returnPrice !== line.basePrice;
                    return (
                      <tr key={line.productId} style={styles.cartTr}>
                        <td style={styles.cartTd}>
                          <div style={{ fontWeight: 600 }}>{line.name}</div>
                          {line.checked && line.neverPurchased && (
                            <span style={styles.neverPurchasedTag}>{t('customerDetail.newReturn.neverPurchased')}</span>
                          )}
                        </td>
                        <td style={{ ...styles.cartTd, fontSize: 12, color: '#94a3b8' }}>{line.barcode}</td>
                        <td style={styles.cartTd}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="text"
                              inputMode={isDecimal ? 'decimal' : 'numeric'}
                              style={{ ...styles.smallInput, width: 70, borderColor: qtyEmpty ? '#dc2626' : '#e2e8f0' }}
                              value={qtyDraft ?? line.quantity}
                              onChange={e => handleReturnQtyChange(line.productId, e.target.value)}
                              onBlur={() => handleReturnQtyBlur(line.productId)}
                            />
                            <span style={{ fontSize: 12, color: '#64748b' }}>{unit}</span>
                          </div>
                        </td>
                        <td style={styles.cartTd}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              style={{ ...styles.smallInput, borderColor: priceChanged ? '#F59E0B' : '#e2e8f0' }}
                              value={priceDraft ?? line.returnPrice}
                              onChange={e => handleReturnPriceChange(line.productId, e.target.value)}
                              onBlur={() => handleReturnPriceBlur(line.productId)}
                            />
                            {priceChanged && (
                              <button type="button" style={styles.resetPriceBtn} onClick={() => resetReturnLinePrice(line.productId)}>
                                {t('customerDetail.newReturn.reset')}
                              </button>
                            )}
                          </div>
                          {priceChanged && <span style={styles.modifiedBadge}>{t('customerDetail.newReturn.modified')}</span>}
                        </td>
                        <td style={{ ...styles.cartTd, fontWeight: 600 }}>
                          {(line.quantity * line.returnPrice).toFixed(2)} ₾
                        </td>
                        <td style={styles.cartTd}>
                          <button style={styles.removeBtn} onClick={() => removeReturnLine(line.productId)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={styles.cartRight}>
            <div style={styles.totalRow}>
              <span>{t('customerDetail.newReturn.total')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{returnTotal.toFixed(2)} ₾</span>
                <button type="button" style={styles.resetLink} onClick={resetReturnCart}>{t('customerDetail.newSale.reset')}</button>
              </div>
            </div>

            <div style={styles.payTypeSection}>
              <div style={styles.payTypeLabel}>{t('customerDetail.newReturn.refundMethod')}</div>
              <div style={styles.payTypeRow}>
                <button
                  style={{ ...styles.payTypeBtn, ...(refundMethod === 'cash' ? styles.refundBtnCash : {}) }}
                  onClick={() => setRefundMethod('cash')}
                >
                  {t('customerDetail.newReturn.refundCash')}
                </button>
                <button
                  style={{ ...styles.payTypeBtn, ...(refundMethod === 'credit' ? styles.refundBtnCredit : {}) }}
                  onClick={() => setRefundMethod('credit')}
                >
                  {t('customerDetail.newReturn.refundCredit')}
                </button>
              </div>
            </div>

            {returnCart.length > 0 && refundMethod === 'cash' && (
              <div style={styles.cashNote}>{t('customerDetail.newReturn.cashRefundNote', { amount: returnTotal.toFixed(2) })}</div>
            )}
            {returnCart.length > 0 && refundMethod === 'credit' && (
              <div style={styles.debtNote}>{t('customerDetail.newReturn.deductNote', { amount: returnTotal.toFixed(2) })}</div>
            )}

            {returnSuccess && <p style={styles.success}>{returnSuccess}</p>}

            <button
              style={{ ...styles.processBtn, opacity: returnLoading || returnCart.length === 0 ? 0.7 : 1 }}
              onClick={handleProcessReturn}
              disabled={returnLoading || returnCart.length === 0}
            >
              {returnLoading ? t('customerDetail.newReturn.processing') : t('customerDetail.newReturn.process')}
            </button>
          </div>
        </div>
      )}

      {deleteModal && (
        <div style={styles.overlay} onClick={e => e.target === e.currentTarget && !deleteLoading && setDeleteModal(false)}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>{t('customerDetail.deleteModal.title', { name: info.name })}</h3>
            <p style={styles.modalBody}>
              {balance > 0
                ? t('customerDetail.deleteModal.blockedWithBalance', { balance: balance.toFixed(2) })
                : t('customerDetail.deleteModal.warningNoBalance')}
            </p>
            {balance <= 0 && <p style={styles.modalNote}>{t('customerDetail.deleteModal.keepHistoryNote')}</p>}
            {deleteError && <p style={styles.error}>{deleteError}</p>}
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setDeleteModal(false)} disabled={deleteLoading}>
                {balance > 0 ? t('common.close') : t('common.cancel')}
              </button>
              {balance <= 0 && (
                <button style={{ ...styles.confirmDeleteBtn, opacity: deleteLoading ? 0.7 : 1 }} onClick={handleDelete} disabled={deleteLoading}>
                  {deleteLoading ? t('customerDetail.deleteModal.deleting') : t('customerDetail.deleteModal.confirmBtn')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, fontWeight: 500, padding: 0 },
  deleteBtn: { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: '95vw', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' },
  modalTitle: { margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#111827' },
  modalBody: { margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.5 },
  modalNote: { margin: '0 0 18px', fontSize: 13, color: '#6B7280', lineHeight: 1.5 },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: { background: '#F3F4F8', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  confirmDeleteBtn: { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  topRow: { display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-start' },
  infoCard: { flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24 },
  customerName: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1e293b' },
  phone: { margin: '0 0 4px', fontSize: 15, color: '#475569' },
  description: { margin: '0 0 16px', fontSize: 14, color: '#64748b' },
  balanceBox: { border: '2px solid', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  balanceLabel: { fontSize: 14, color: '#64748b', fontWeight: 500 },
  balanceAmount: { fontSize: 26, fontWeight: 800 },
  payCard: { width: 280, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24 },
  payTitle: { margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1e293b' },
  payForm: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 13, fontWeight: 500, color: '#475569' },
  input: { padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 15 },
  payBtn: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 15 },
  error: { color: '#dc2626', margin: 0, fontSize: 13 },
  success: { color: '#16a34a', margin: 0, fontSize: 13, fontWeight: 600 },
  sectionTitle: { margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#1e293b' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  thead: { background: '#f1f5f9' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 16px', fontSize: 14, color: '#334155' },
  empty: { padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  typeBadge: { fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10 },
  itemsTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  itemTh: { padding: '5px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  itemTd: { padding: '5px 10px', color: '#475569' },
  code: { background: '#F3F4F8', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', color: '#6B7280' },

  tabBar: { display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F8', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: { padding: '7px 16px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#6B7280', fontWeight: 500 },
  activeTab: { background: '#fff', color: '#111827', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },

  cartLayout: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  cartLeft: { flex: 1, minWidth: 0 },
  cartRight: { width: 292, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB', position: 'sticky', top: 24 },
  emptyCart: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 15, marginTop: 12 },
  cartTable: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: 12 },
  cartThead: { background: '#F9FAFB' },
  cartTh: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' },
  cartTr: { borderBottom: '1px solid #F3F4F6' },
  cartTd: { padding: '10px 12px', fontSize: 14, color: '#374151' },
  smallInput: { padding: '5px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 14, width: 90, boxSizing: 'border-box', background: '#F9FAFB' },
  removeBtn: { background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },

  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: 20, marginBottom: 16, color: '#111827' },
  resetLink: { background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, textDecoration: 'underline' },

  payTypeSection: { marginBottom: 12 },
  payTypeLabel: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  payTypeRow: { display: 'flex', gap: 6 },
  payTypeBtn: { flex: 1, padding: '8px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  payTypeBtnActive: { background: '#059669', color: '#fff', borderColor: '#059669' },
  payTypeBtnDebit: { background: '#DC2626', color: '#fff', borderColor: '#DC2626' },
  refundBtnCash: { background: '#DC2626', color: '#fff', borderColor: '#DC2626' },
  refundBtnCredit: { background: '#059669', color: '#fff', borderColor: '#059669' },

  checkoutBtn: { width: '100%', padding: 13, background: '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15, marginTop: 4 },
  processBtn: { width: '100%', padding: 13, background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15, marginTop: 4 },

  modifiedBadge: { background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, border: '1px solid #FDE68A', marginTop: 4, display: 'inline-block' },
  resetPriceBtn: { background: '#F3F4F8', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' },
  neverPurchasedTag: { display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: 8 },
  cashNote: { fontSize: 12, color: '#B91C1C', background: '#FEF2F2', padding: '6px 10px', borderRadius: 6, fontWeight: 500, marginBottom: 12 },
  debtNote: { fontSize: 12, color: '#059669', background: '#F0FDF4', padding: '6px 10px', borderRadius: 6, fontWeight: 500, marginBottom: 12 },
};
