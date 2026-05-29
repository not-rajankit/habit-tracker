import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { refreshUser } = useAuth();
  const status = params.get('status');

  useEffect(() => {
    if (status === 'success') refreshUser();
  }, [refreshUser, status]);

  if (status === 'success') return <Navigate to="/" replace />;
  return <Navigate to="/login" replace state={{ authError: params.get('reason') || 'oauth_failed' }} />;
}
