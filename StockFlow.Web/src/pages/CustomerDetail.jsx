import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const TYPE_LABELS = { CashSale: 'Cash Sale', DebitSale: 'Debit Sale', Return: 'Return', Payment: 'Payment' };
const TYPE_COLORS = { CashSale: '#16a34a', DebitSale: '#dc2626', Return: '#f59e0b', Payment: '#2563eb' };

export default function CustomerDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());

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
    if (!amount || amount <= 0) { setPayError('Enter a valid amount.'); return; }
    try {
      await customersApi.recordPayment(id, { userId: user.id, amount });
      setPaySuccess(`Payment of ${amount.toFixed(2)} ₾ recorded.`);
      setPayAmount('');
      load();
    } catch (err) {
      setPayError(err.response?.data?.error || 'Failed to record payment.');
    }
  };

  const toggleExpand = (txId) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(txId) ? next.delete(txId) : next.add(txId);
      return next;
    });
  };

  if (loading) return <p style={{ color: '#64748b' }}>Loading...</p>;
  if (!detail) return null;

  const { info, transactions } = detail;
  const balance = info.balance;

  return (
    <div>
      <button style={styles.backBtn} onClick={() => navigate('/customers')}>← Back</button>

      <div style={styles.topRow}>
        <div style={styles.infoCard}>
          <h2 style={styles.customerName}>{info.name}</h2>
          <p style={styles.phone}>{info.phoneNumber}</p>
          {info.description && <p style={styles.description}>{info.description}</p>}
          <div style={{ ...styles.balanceBox, borderColor: balance > 0 ? '#fca5a5' : '#86efac', background: balance > 0 ? '#fef2f2' : '#f0fdf4' }}>
            <span style={styles.balanceLabel}>Current Balance (Debt)</span>
            <span style={{ ...styles.balanceAmount, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
              {balance.toFixed(2)} ₾
            </span>
          </div>
        </div>

        <div style={styles.payCard}>
          <h3 style={styles.payTitle}>Record Payment</h3>
          <form onSubmit={handlePayment} style={styles.payForm}>
            <label style={styles.label}>Amount (₾)</label>
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
            <button style={styles.payBtn} type="submit">Record Payment</button>
          </form>
        </div>
      </div>

      <h3 style={styles.sectionTitle}>Transaction History</h3>
      <table style={styles.table}>
        <thead>
          <tr style={styles.thead}>
            <th style={{ ...styles.th, width: 28 }}></th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Type</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(t => {
            const isPositive = t.amount > 0;
            const hasItems = t.items && t.items.length > 0;
            const isOpen = expanded.has(t.id);
            return (
              <>
                <tr key={t.id} style={{ ...styles.tr, cursor: hasItems ? 'pointer' : 'default' }}
                  onClick={() => hasItems && toggleExpand(t.id)}>
                  <td style={{ ...styles.td, color: '#94a3b8', fontSize: 12, paddingRight: 0 }}>
                    {hasItems ? (isOpen ? '▾' : '▸') : ''}
                  </td>
                  <td style={styles.td}>{new Date(t.createdAt).toLocaleString()}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.typeBadge, background: (TYPE_COLORS[t.type] ?? '#475569') + '22', color: TYPE_COLORS[t.type] ?? '#475569' }}>
                      {TYPE_LABELS[t.type] ?? t.type}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: isPositive ? '#dc2626' : '#16a34a' }}>
                    {isPositive ? '+' : ''}{t.amount.toFixed(2)} ₾
                  </td>
                </tr>
                {hasItems && isOpen && (
                  <tr key={`${t.id}-items`} style={{ background: '#f8fafc' }}>
                    <td colSpan={4} style={{ padding: '0 0 8px 44px' }}>
                      <table style={styles.itemsTable}>
                        <thead>
                          <tr>
                            <th style={styles.itemTh}>Product</th>
                            <th style={styles.itemTh}>Qty</th>
                            <th style={styles.itemTh}>Unit Price</th>
                            <th style={{ ...styles.itemTh, textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.items.map((item, idx) => (
                            <tr key={idx}>
                              <td style={styles.itemTd}>{item.productName}</td>
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
            <tr><td colSpan={4} style={styles.empty}>No transactions yet.</td></tr>
          )}
        </tbody>
        {transactions.length > 0 && (
          <tfoot>
            <tr style={{ background: '#f8fafc' }}>
              <td colSpan={3} style={{ ...styles.td, fontWeight: 700 }}>Net Balance</td>
              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontSize: 16, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                {balance.toFixed(2)} ₾
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

const styles = {
  backBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, fontWeight: 500, padding: '0 0 16px', display: 'block' },
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
};
