import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import POS from './pages/POS';
import Products from './pages/Products';
import StockIn from './pages/StockIn';
import Returns from './pages/Returns';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import CashClosing from './pages/CashClosing';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'Admin') return <Navigate to="/pos" />;
  return children;
}

function DefaultRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'Admin' ? '/products' : '/pos'} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/pos" element={<POS />} />
                  <Route path="/returns" element={<Returns />} />
                  <Route path="/closing" element={<CashClosing />} />
                  <Route path="/products" element={<AdminRoute><Products /></AdminRoute>} />
                  <Route path="/stock" element={<AdminRoute><StockIn /></AdminRoute>} />
                  <Route path="/customers" element={<AdminRoute><Customers /></AdminRoute>} />
                  <Route path="/customers/:id" element={<AdminRoute><CustomerDetail /></AdminRoute>} />
                  <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
                  <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
                  <Route path="*" element={<DefaultRedirect />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
