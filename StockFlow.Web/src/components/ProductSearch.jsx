import { forwardRef, useEffect, useRef, useState } from 'react';
import { productsApi } from '../api/client';

const UNIT_LABELS = { 0: 'pcs', 1: 'm', 2: 'm²', 3: 'L' };

/**
 * Reusable product search with autocomplete and keyboard navigation.
 *
 * Props:
 *   onSelect(product)   — called with full ProductDto (includes stockQuantity)
 *   placeholder         — input placeholder text
 *   clearAfterSelect    — if true, clears input and refocuses after selection (POS mode)
 *   autoFocus           — focuses input on mount
 *   inputStyle          — override input CSS
 */
const ProductSearch = forwardRef(function ProductSearch(
  {
    onSelect,
    placeholder = 'Search by name or barcode...',
    clearAfterSelect = false,
    autoFocus = false,
    inputStyle = {},
  },
  ref
) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Merge forwarded ref with internal ref
  const setRefs = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = async (q) => {
    if (!q.trim()) { setSuggestions([]); setOpen(false); setSearched(false); return; }
    try {
      const { data } = await productsApi.search(q.trim());
      setSuggestions(data);
      setSearched(true);
      setOpen(true);
      setHighlighted(-1);
    } catch { setSuggestions([]); setSearched(true); setOpen(true); }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSearched(false);
    clearTimeout(debounceRef.current);

    if (!val.trim()) { setSuggestions([]); setOpen(false); return; }

    // Shorter delay for inputs without spaces (likely barcode)
    const delay = val.includes(' ') ? 300 : 200;
    debounceRef.current = setTimeout(() => doSearch(val), delay);
  };

  const commit = async (product) => {
    // Fetch full product (with stockQuantity) by barcode
    try {
      const { data: full } = await productsApi.getByBarcode(product.barcode);
      afterSelect(full);
      onSelect(full);
    } catch {
      // Fallback: onSelect with whatever we have (no stock info)
      afterSelect(product);
      onSelect(product);
    }
  };

  const commitFull = (full) => {
    // Already a full product (from barcode API)
    afterSelect(full);
    onSelect(full);
  };

  const afterSelect = (product) => {
    clearTimeout(debounceRef.current);
    setSuggestions([]);
    setOpen(false);
    setHighlighted(-1);
    setSearched(false);
    if (clearAfterSelect) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery(`${product.name} — ${product.barcode}`);
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceRef.current);

      // Select keyboard-highlighted suggestion
      if (highlighted >= 0 && suggestions[highlighted]) {
        commit(suggestions[highlighted]);
        return;
      }

      // Try exact barcode lookup
      const q = query.trim();
      if (!q) return;
      try {
        const { data: product } = await productsApi.getByBarcode(q);
        commitFull(product);
      } catch {
        // Not an exact barcode — run name search and show dropdown
        doSearch(q);
      }
    }
  };

  const showDropdown = open && query.trim();

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <input
        ref={setRefs}
        style={{ ...styles.input, ...inputStyle }}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {showDropdown && (
        <div style={styles.dropdown}>
          {suggestions.length === 0 && searched ? (
            <div style={styles.emptyMsg}>No product found for "{query}"</div>
          ) : (
            suggestions.map((p, i) => (
              <div
                key={p.id}
                style={{ ...styles.item, ...(i === highlighted ? styles.itemActive : {}) }}
                onMouseEnter={() => setHighlighted(i)}
                onMouseLeave={() => setHighlighted(-1)}
                onMouseDown={(e) => { e.preventDefault(); commit(p); }}
              >
                <div style={styles.itemName}>{highlightMatch(p.name, query)}</div>
                <div style={styles.itemMeta}>
                  <code style={styles.barcode}>{p.barcode}</code>
                  <span>{p.sellingPrice.toFixed(2)} ₾</span>
                  <span style={styles.unitTag}>{UNIT_LABELS[p.unitType] ?? 'pcs'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

export default ProductSearch;

function highlightMatch(text, query) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fef08a', borderRadius: 2, padding: 0 }}>
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

const styles = {
  wrapper: { position: 'relative', width: '100%' },
  input: {
    width: '100%', padding: '11px 14px', border: '2px solid #2563eb',
    borderRadius: 6, fontSize: 15, outline: 'none', boxSizing: 'border-box',
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200,
    maxHeight: 320, overflowY: 'auto',
  },
  item: {
    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.08s',
  },
  itemActive: { background: '#eff6ff' },
  itemName: { fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 3 },
  itemMeta: { display: 'flex', gap: 10, fontSize: 12, color: '#64748b', alignItems: 'center' },
  barcode: { background: '#f1f5f9', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace' },
  unitTag: { background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: 3, fontWeight: 600 },
  emptyMsg: { padding: '14px 16px', color: '#94a3b8', fontSize: 14, textAlign: 'center' },
};
