import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-[50vh] animate-fade-in" />;
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}
