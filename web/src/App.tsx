import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Analyses from './pages/Analyses';
import AnalysisDetail from './pages/AnalysisDetail';
import Requirements from './pages/Requirements';
import Hotspots from './pages/Hotspots';
import QAHealth from './pages/QAHealth';
import ProductInsights from './pages/ProductInsights';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Callback from './pages/Callback';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-dark-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/callback" element={<Callback />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="analyses" element={<Analyses />} />
        <Route path="analyses/:id" element={<AnalysisDetail />} />
        <Route path="requirements" element={<Requirements />} />
        <Route path="hotspots" element={<Hotspots />} />
        <Route path="qa-health" element={<QAHealth />} />
        <Route path="product-insights" element={<ProductInsights />} />
        <Route path="product-insights/:analysisId" element={<ProductInsights />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

