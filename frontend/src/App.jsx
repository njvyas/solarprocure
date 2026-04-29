import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import SetupPage from './pages/auth/SetupPage';
import SystemSettingsPage from './pages/settings/SystemSettingsPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import UsersPage from './pages/users/UsersPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import TenantSettingsPage from './pages/tenants/TenantSettingsPage';
import AuditLogsPage from './pages/tenants/AuditLogsPage';
import VendorsPage from './pages/vendors/VendorsPage';
import VendorRegisterPage from './pages/vendors/VendorRegisterPage';
import VendorDetailPage from './pages/vendors/VendorDetailPage';
import BomsPage from './pages/boms/BomsPage';
import BomDetailPage from './pages/boms/BomDetailPage';
import RfqsPage from './pages/rfqs/RfqsPage';
import RfqDetailPage from './pages/rfqs/RfqDetailPage';
import RfqRespondPage from './pages/rfqs/RfqRespondPage';
import QuotesPage from './pages/quotes/QuotesPage';
import BiddingPage from './pages/bidding/BiddingPage';
import BiddingDetailPage from './pages/bidding/BiddingDetailPage';
import BidPage from './pages/bidding/BidPage';
import EvaluationsPage from './pages/evaluations/EvaluationsPage';
import EvaluationDetailPage from './pages/evaluations/EvaluationDetailPage';
import PosPage from './pages/pos/PosPage';
import PoDetailPage from './pages/pos/PoDetailPage';
import BackupPage from './pages/backup/BackupPage';
import ReportsDashboard from './pages/reports/ReportsDashboard';
import AiInsightsPage from './pages/ai/AiInsightsPage';
import AiInsightDetailPage from './pages/ai/AiInsightDetailPage';
import AiChatPage from './pages/ai/AiChatPage';
import AiSettingsPage from './pages/ai/AiSettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/setup"              element={<SetupPage />} />
          <Route path="/login"              element={<LoginPage />} />
          <Route path="/vendor-register"    element={<VendorRegisterPage />} />
          <Route path="/rfq-respond/:token" element={<RfqRespondPage />} />
          <Route path="/bid/:token"         element={<BidPage />} />
          <Route path="/"                   element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"             element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
          <Route path="/system-settings"       element={<ProtectedRoute permission={['settings','read']}><AppLayout><SystemSettingsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/vendors"               element={<ProtectedRoute permission={['vendors','read']}><AppLayout><VendorsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/vendors/:id"           element={<ProtectedRoute permission={['vendors','read']}><AppLayout><VendorDetailPage /></AppLayout></ProtectedRoute>} />
          <Route path="/boms"                  element={<ProtectedRoute permission={['boms','read']}><AppLayout><BomsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/boms/:id"              element={<ProtectedRoute permission={['boms','read']}><AppLayout><BomDetailPage /></AppLayout></ProtectedRoute>} />
          <Route path="/rfqs"                  element={<ProtectedRoute permission={['rfqs','read']}><AppLayout><RfqsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/rfqs/:id"              element={<ProtectedRoute permission={['rfqs','read']}><AppLayout><RfqDetailPage /></AppLayout></ProtectedRoute>} />
          <Route path="/quotes"                element={<ProtectedRoute permission={['quotes','read']}><AppLayout><QuotesPage /></AppLayout></ProtectedRoute>} />
          <Route path="/bidding"               element={<ProtectedRoute permission={['rfqs','read']}><AppLayout><BiddingPage /></AppLayout></ProtectedRoute>} />
          <Route path="/bidding/:id"           element={<ProtectedRoute permission={['rfqs','read']}><AppLayout><BiddingDetailPage /></AppLayout></ProtectedRoute>} />
          <Route path="/evaluations"           element={<ProtectedRoute permission={['quotes','read']}><AppLayout><EvaluationsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/evaluations/:id"       element={<ProtectedRoute permission={['quotes','read']}><AppLayout><EvaluationDetailPage /></AppLayout></ProtectedRoute>} />
          <Route path="/purchase-orders"       element={<ProtectedRoute permission={['pos','read']}><AppLayout><PosPage /></AppLayout></ProtectedRoute>} />
          <Route path="/purchase-orders/:id"   element={<ProtectedRoute permission={['pos','read']}><AppLayout><PoDetailPage /></AppLayout></ProtectedRoute>} />
          <Route path="/backup"                element={<ProtectedRoute permission={['backup','read']}><AppLayout><BackupPage /></AppLayout></ProtectedRoute>} />
          <Route path="/reports"               element={<ProtectedRoute permission={['reports','read']}><AppLayout><ReportsDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/ai/insights"           element={<ProtectedRoute permission={['ai','read']}><AppLayout><AiInsightsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/ai/insights/:id"       element={<ProtectedRoute permission={['ai','read']}><AppLayout><AiInsightDetailPage /></AppLayout></ProtectedRoute>} />
          <Route path="/ai/chat"               element={<ProtectedRoute permission={['ai','use']}><AppLayout><AiChatPage /></AppLayout></ProtectedRoute>} />
          <Route path="/ai/settings"           element={<ProtectedRoute permission={['ai','manage']}><AppLayout><AiSettingsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/profile"              element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
          <Route path="/tenant-settings"      element={<ProtectedRoute permission={['tenants','read']}><AppLayout><TenantSettingsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/users"                 element={<ProtectedRoute permission={['users','read']}><AppLayout><UsersPage /></AppLayout></ProtectedRoute>} />
          <Route path="/audit-logs"            element={<ProtectedRoute permission={['audit','read']}><AppLayout><AuditLogsPage /></AppLayout></ProtectedRoute>} />
          <Route path="*"                      element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
