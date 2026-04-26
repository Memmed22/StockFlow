import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const NAV_KEYS = [
  { to: '/pos',       key: 'nav.pos',      roles: ['Admin', 'Cashier'] },
  { to: '/returns',   key: 'nav.returns',  roles: ['Admin', 'Cashier'] },
  { to: '/closing',   key: 'nav.cashClose', roles: ['Admin', 'Cashier'] },
  { to: '/products',  key: 'nav.products', roles: ['Admin'] },
  { to: '/stock',     key: 'nav.stockIn',  roles: ['Admin'] },
  { to: '/customers', key: 'nav.customers', roles: ['Admin'] },
  { to: '/reports',   key: 'nav.reports',  roles: ['Admin'] },
  { to: '/users',     key: 'nav.users',    roles: ['Admin'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const navItems = NAV_KEYS.filter(item => item.roles.includes(user?.role));
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? '??';

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleLang = (e) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  return (
    <div style={styles.root}>
      <nav style={styles.nav}>

        {/* Brand */}
        <div style={styles.brand}>
          <span style={styles.brandMark}>S</span>
          <span style={styles.brandText}>Stock<span style={styles.brandAccent}>Flow</span></span>
        </div>

        <div style={styles.divider} />

        {/* Nav Links */}
        <div style={styles.links}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive ? styles.activeLink : {}),
              })}
            >
              {t(item.key)}
            </NavLink>
          ))}
        </div>

        {/* User Area */}
        <div style={styles.user}>
          <span style={styles.roleBadge}>{user?.role}</span>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>{initials}</div>
            <span style={styles.userName}>{user?.username}</span>
          </div>
          <select style={styles.langSelect} value={i18n.language} onChange={handleLang}>
            <option value="en">EN</option>
            <option value="ka">ქარ</option>
            <option value="az">AZ</option>
          </select>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            {t('nav.signOut')}
          </button>
        </div>
      </nav>

      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-bg)',
  },
  nav: {
    background: 'var(--color-nav)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    height: 60,
    gap: 0,
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 1px 0 rgba(255,255,255,0.05)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginRight: 24,
    flexShrink: 0,
  },
  brandMark: {
    width: 30,
    height: 30,
    background: 'var(--color-primary)',
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  brandText: {
    fontSize: 16,
    fontWeight: 700,
    color: '#F9FAFB',
    letterSpacing: '-0.02em',
  },
  brandAccent: {
    color: '#818CF8',
  },
  divider: {
    width: 1,
    height: 24,
    background: 'rgba(255,255,255,0.1)',
    marginRight: 20,
    flexShrink: 0,
  },
  links: {
    display: 'flex',
    gap: 2,
    flex: 1,
  },
  link: {
    color: '#9CA3AF',
    padding: '6px 13px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontWeight: 500,
    transition: 'color 0.15s, background 0.15s',
    whiteSpace: 'nowrap',
  },
  activeLink: {
    background: 'rgba(255,255,255,0.1)',
    color: '#F9FAFB',
    fontWeight: 600,
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.07)',
    color: '#6B7280',
    padding: '3px 8px',
    borderRadius: 20,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  userName: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: 500,
  },
  langSelect: {
    background: 'transparent', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 'var(--radius-sm)', padding: '5px 8px', cursor: 'pointer', fontSize: 12,
    fontWeight: 600, outline: 'none',
  },
  logoutBtn: {
    background: 'transparent',
    color: '#9CA3AF',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 13px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  main: {
    flex: 1,
    padding: '28px 28px',
  },
};
