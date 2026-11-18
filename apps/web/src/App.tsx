import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./layout/AppShell";
import { AdminSetupPage } from "./pages/AdminSetupPage";
import { ComplaintDetailPage } from "./pages/ComplaintDetailPage";
import { ComplaintListPage } from "./pages/ComplaintListPage";
import { ComplaintMapPage } from "./pages/ComplaintMapPage";
import { ClassificationReviewPage } from "./pages/ClassificationReviewPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FutureFeaturesPage } from "./pages/FutureFeaturesPage";
import { IntegrationStatusPage } from "./pages/IntegrationStatusPage";
import { LoginPage } from "./pages/LoginPage";
import { KnowledgeChatPage } from "./pages/KnowledgeChatPage";
import { KnowledgeDocumentsPage } from "./pages/KnowledgeDocumentsPage";
import { NewComplaintPage } from "./pages/NewComplaintPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ReassignmentPage } from "./pages/ReassignmentPage";
import { ReportsPage } from "./pages/ReportsPage";

const ProtectedLayout = () => (
  <RequireAuth>
    <AppShell><Outlet /></AppShell>
  </RequireAuth>
);

export const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/complaints" element={<ComplaintListPage />} />
      <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
      <Route path="/complaints/new" element={<RequireAuth roles={["CITIZEN"]}><NewComplaintPage /></RequireAuth>} />
      <Route path="/map" element={<RequireAuth roles={["DEPARTMENT", "ADMINISTRATOR"]}><ComplaintMapPage /></RequireAuth>} />
      <Route path="/admin/setup" element={<RequireAuth roles={["ADMINISTRATOR"]}><AdminSetupPage /></RequireAuth>} />
      <Route path="/admin/classifications" element={<RequireAuth roles={["ADMINISTRATOR"]}><ClassificationReviewPage /></RequireAuth>} />
      <Route path="/admin/integrations" element={<RequireAuth roles={["ADMINISTRATOR"]}><IntegrationStatusPage /></RequireAuth>} />
      <Route path="/reassignments" element={<RequireAuth roles={["DEPARTMENT", "ADMINISTRATOR"]}><ReassignmentPage /></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth roles={["DEPARTMENT", "ADMINISTRATOR"]}><ReportsPage /></RequireAuth>} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/knowledge" element={<RequireAuth roles={["CITIZEN"]}><KnowledgeChatPage /></RequireAuth>} />
      <Route path="/admin/knowledge" element={<RequireAuth roles={["ADMINISTRATOR"]}><KnowledgeDocumentsPage /></RequireAuth>} />
      <Route path="/future" element={<FutureFeaturesPage />} />
    </Route>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

