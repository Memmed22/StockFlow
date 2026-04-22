import { useEffect, useRef, useState } from 'react';
import { stockApi } from '../api/client';
import ProductSearch from '../components/ProductSearch';

const UNIT_LABELS = { 0: 'pcs', 1: 'm', 2: 'm²', 3: 'L' };
const UNIT_IS_DECIMAL = { 0: false, 1: true, 2: true, 3: true };
const PAGE_SIZE = 20;

const TYPE_STYLE = {
  StockIn: { bg: '#D1FAE5', color: '#065F46' },
  Sale:    { bg: '#FEE2E2', color: '#B91C1C' },
  Return:  { bg: '#FEF3C7', color: '#92400E' },
};

export default function StockIn() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [movements, setMovements] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingTable, setLoadingTable] = useState(false);

  const debounceRef = useRef(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    loadMovements(search, page);
  }, [page]);

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
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!selectedProduct) { setError('Please select a product from the list.'); return; }
    const isDecimal = UNIT_IS_DECIMAL[selectedProduct.unitType ?? 0];
    const qty = isDecimal ? parseFloat(quantity) : parseInt(quantity);
    if (!qty || qty <= 0) { setError('Enter a valid quantity.'); return; }
    try {
      await stockApi.stockIn({ productId: selectedProduct.id, quantity: qty, note: note || null });
      setMessage(`Added ${qty} ${UNIT_LABELS[selectedProduct.unitType ?? 0]} of "${selectedProduct.name}" to stock.`);
      setSelectedProduct(null);
      setQuantity('');
      setNote('');
      setPage(1);
      loadMovements(search, 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Error adding stock.');
    }
  };

  const isDecimal = UNIT_IS_DECIMAL[selectedProduct?.unitType ?? 0];
  const unitLabel = selectedProduct ? UNIT_LABELS[selectedProduct.unitType ?? 0] : '';

  return (
    <div>
      <div style={s.pageHeader}>
        <h2 style={s.title}>Stock In</h2>
        <p style={s.subtitle}>Record incoming inventory for a product</p>
      </div>

      {/* Add stock form */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>Add Stock</h3>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Product *</label>
            <ProductSearch onSelect={handleProductSelect} placeholder="Search by name or barcode..." />
            {selectedProduct && (
              <div style={s.selectedBadge}>
                <span>✓</span>
                <span>
                  <strong>{selectedProduct.name}</strong> · {selectedProduct.barcode} · Current stock:{' '}
                  <strong>{selectedProduct.stockQuantity} {unitLabel}</strong>
                </span>
              </div>
            )}
          </div>

          <div style={s.twoCol}>
            <div style={s.field}>
              <label style={s.label}>Quantity{unitLabel ? ` (${unitLabel})` : ''} *</label>
              <input
                style={s.input}
                type="number"
                min={isDecimal ? '0.01' : '1'}
                step={isDecimal ? '0.01' : '1'}
                required
                placeholder={isDecimal ? 'e.g. 12.5' : 'e.g. 10'}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Note</label>
              <input style={s.input} placeholder="Optional (supplier, batch…)"
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>

          {message && <div style={s.successBox}>{message}</div>}
          {error && <div style={s.errorBox}>{error}</div>}

          <button style={s.submitBtn} type="submit">Add Stock</button>
        </form>
      </div>

      {/* Movements table */}
      <div style={s.tableHeader}>
        <div>
          <h3 style={s.sectionTitle}>Stock Movements</h3>
          <p style={s.sectionSub}>{totalCount} total record{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <input
          style={s.searchInput}
          placeholder="Search by name or barcode…"
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Date</th>
              <th style={s.th}>Product</th>
              <th style={s.th}>Barcode</th>
              <th style={s.th}>Type</th>
              <th style={s.th}>Quantity</th>
              <th style={s.th}>Note</th>
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
                  {search ? `No movements matching "${search}".` : 'No movements yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={s.pagination}>
          <button
            style={{ ...s.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
          >
            ← Previous
          </button>
          <span style={s.pageInfo}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            style={{ ...s.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }}
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  pageHeader: { marginBottom: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },

  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#111827' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, background: '#F9FAFB', color: '#111827', boxSizing: 'border-box', width: '100%' },
  selectedBadge: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#065F46', background: '#D1FAE5', border: '1px solid #6EE7B7', padding: '8px 12px', borderRadius: 8 },
  successBox: { background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#065F46', fontWeight: 500 },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', fontWeight: 500 },
  submitBtn: { background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 15, alignSelf: 'flex-start' },

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
};
