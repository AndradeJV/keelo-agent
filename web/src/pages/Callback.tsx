import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // The AuthProvider handles the callback
    // This component just shows a loading state
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-keelo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-dark-400">Autenticando...</p>
      </div>
    </div>
  );
}

