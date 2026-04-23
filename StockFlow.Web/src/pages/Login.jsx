import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await usersApi.login(form);
      login(data);
      navigate('/pos');
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.error || t('login.errorServer', { status: err.response.status }));
      } else if (err.request) {
        setError(t('login.errorNetwork'));
      } else {
        setError(err.message || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.logoMark}>S</div>
          <h1 style={styles.heroTitle}>Stock<span style={styles.heroAccent}>Flow</span></h1>
          <p style={styles.heroSub}>{t('login.heroPOS')}</p>
          <div style={styles.features}>
            {t('login.features', { returnObjects: true }).map(f => (
              <div key={f} style={styles.featureItem}>
                <span style={styles.featureDot} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={styles.leftFooter}>{t('login.version')}</p>
      </div>

      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>{t('login.welcomeBack')}</h2>
            <p style={styles.cardSub}>{t('login.signInSub')}</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>{t('login.username')}</label>
              <input
                style={styles.input}
                placeholder={t('login.usernamePlaceholder')}
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                autoFocus
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>{t('login.password')}</label>
              <input
                style={styles.input}
                type="password"
                placeholder={t('login.passwordPlaceholder')}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-sans)' },
  left: { width: '45%', background: 'linear-gradient(145deg, #0F172A 0%, #1E1B4B 60%, #312E81 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px', position: 'relative', overflow: 'hidden' },
  leftInner: { display: 'flex', flexDirection: 'column', gap: 0 },
  logoMark: { width: 48, height: 48, background: '#4F46E5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 40 },
  heroTitle: { margin: 0, fontSize: 44, fontWeight: 700, color: '#F9FAFB', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 },
  heroAccent: { color: '#818CF8' },
  heroSub: { margin: '0 0 40px', fontSize: 16, color: '#9CA3AF', lineHeight: 1.5 },
  features: { display: 'flex', flexDirection: 'column', gap: 14 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 12, color: '#C7D2FE', fontSize: 14, fontWeight: 500 },
  featureDot: { width: 6, height: 6, borderRadius: '50%', background: '#818CF8', flexShrink: 0 },
  leftFooter: { margin: 0, fontSize: 12, color: '#4B5563', fontWeight: 500 },
  right: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 32 },
  card: { background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '40px 40px', width: '100%', maxWidth: 380 },
  cardHeader: { marginBottom: 28 },
  cardTitle: { margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  cardSub: { margin: 0, fontSize: 14, color: '#6B7280' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, color: '#111827', outline: 'none', transition: 'border-color 0.15s', background: '#F9FAFB', width: '100%' },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', fontWeight: 500 },
  btn: { padding: '12px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4, letterSpacing: '-0.01em' },
};
