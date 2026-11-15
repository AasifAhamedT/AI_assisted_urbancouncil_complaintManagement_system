import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import type { RoleCode } from "../api/types";
import { useAuth } from "./AuthContext";

export const RequireAuth = ({ children, roles }: { children: ReactNode; roles?: RoleCode[] }) => {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(session.user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};
