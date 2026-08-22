import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
const TYPE_COLORS = { CashSale: '#2563eb', DebitSale: '#dc2626', Return: '#d97706', CreditReturn: '#7c3aed', Payment: '#16a34a' };

export default function CustomerDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.getById(id);
      setDetail(data);
    } catch { navigate('/customers'); }
    finally { setLoading(false); }
  };

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
      </div>

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
            const isPositive = tx.amount > 0;
            const hasItems = tx.items && tx.items.length > 0;
            const isOpen = expanded.has(tx.id);
            return (
              <>
                <tr key={tx.id} style={{ ...styles.tr, cursor: hasItems ? 'pointer' : 'default' }}
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
              </>
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

      {deleteModal && (
        <div style={styles.overlay} onClick={e => e.target === e.currentTarget && !deleteLoading && setDeleteModal(false)}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>{t('customerDetail.deleteModal.title', { name: info.name })}</h3>
            <p style={styles.modalBody}>
              {balance > 0
                ? t('customerDetail.deleteModal.warningWithBalance', { balance: balance.toFixed(2) })
                : t('customerDetail.deleteModal.warningNoBalance')}
            </p>
            <p style={styles.modalNote}>{t('customerDetail.deleteModal.keepHistoryNote')}</p>
            {deleteError && <p style={styles.error}>{deleteError}</p>}
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setDeleteModal(false)} disabled={deleteLoading}>
                {t('common.cancel')}
              </button>
              <button style={{ ...styles.confirmDeleteBtn, opacity: deleteLoading ? 0.7 : 1 }} onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? t('customerDetail.deleteModal.deleting') : t('customerDetail.deleteModal.confirmBtn')}
              </button>
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
  topRow: { display: 'flex', gap: 20, marginBottom: 28, alignItems: 'flex-start' },
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
};
