import React, { useState } from 'react';
import { HealthProvider, useHealth } from './context/HealthContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { MedicalDisclaimer } from './components/common/MedicalDisclaimer';

import { DashboardPage } from './pages/DashboardPage';
import { LiveECGPage } from './pages/LiveECGPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { VitalsPage } from './pages/VitalsPage';
import { SportsPage } from './pages/SportsPage';
import { EventsPage } from './pages/EventsPage';
import { HistoryPage } from './pages/HistoryPage';
import { DevicePage } from './pages/DevicePage';
import { ProfilePage } from './pages/ProfilePage';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
      case 'live-ecg':
        return <LiveECGPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'vitals':
        return <VitalsPage />;
      case 'sports':
        return <SportsPage />;
      case 'events':
        return <EventsPage />;
      case 'history':
        return <HistoryPage />;
      case 'device':
        return <DevicePage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop Left Sidebar */}
      <Sidebar activeTab={activeTab} onNavigate={(tab) => setActiveTab(tab)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onNavigate={(tab) => setActiveTab(tab)}
        />

        {/* Dynamic Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActivePage()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav activeTab={activeTab} onNavigate={(tab) => setActiveTab(tab)} />

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <HealthProvider>
      <AppContent />
    </HealthProvider>
  );
};

export default App;
