import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { Header } from './components/layout/Header.js';

import { LoginView } from './views/LoginView.js';
import { InitialSetupView } from './views/InitialSetupView.js';
import { ChangePasswordView } from './views/ChangePasswordView.js';
import { DashboardView } from './views/DashboardView.js';
import { TasksView } from './views/TasksView.js';
import { DestinationsView } from './views/DestinationsView.js';
import { TemplatesView } from './views/TemplatesView.js';
import { CredentialsView } from './views/CredentialsView.js';
import { CalendarView } from './views/CalendarView.js';
import { ExecutionsView } from './views/ExecutionsView.js';
import { CategoriesView } from './views/CategoriesView.js';
import { UsersView } from './views/UsersView.js';
import { SettingsView } from './views/SettingsView.js';
import { AboutView } from './views/AboutView.js';
import { Template } from './types/index.js';

const MainApp: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, isInitialized, mustChangePassword } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cross-view state
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [navFilter, setNavFilter] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#07090e] text-[var(--cyber-primary)] font-mono text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[var(--cyber-primary)] border-t-transparent rounded-full animate-spin" />
          <span>INICIALIZANDO ELYS...</span>
        </div>
      </div>
    );
  }

  // 1. Clean installation detected: system not yet initialized
  if (isInitialized === false) {
    return <InitialSetupView />;
  }

  // 2. Not logged in
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // 3. User must change default/initial password before entering system
  if (mustChangePassword) {
    return <ChangePasswordView />;
  }

  const getTabHeader = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: t('dashboard.title'), subtitle: t('dashboard.subtitle') };
      case 'tasks':
        return { title: t('tasks.title'), subtitle: t('tasks.subtitle') };
      case 'destinations':
        return { title: t('destinations.title') || 'Destinos de Ejecución', subtitle: t('destinations.subtitle') || 'Equipos y servidores sobre los que ELYS ejecuta tareas' };
      case 'templates':
        return { title: t('templates.title') || 'Plantillas de Tareas', subtitle: t('templates.subtitle') || 'Patrones preconfigurados de ejecución para rápida creación' };
      case 'credentials':
        return { title: t('credentials.title') || 'Almacén de Credenciales', subtitle: t('credentials.subtitle') || 'Gestión segura de credenciales de acceso a equipos' };
      case 'calendar':
        return { title: t('calendar.title'), subtitle: t('calendar.subtitle') };
      case 'executions':
        return { title: t('executions.title'), subtitle: t('executions.subtitle') };
      case 'categories':
        return { title: t('categories.title'), subtitle: t('categories.subtitle') };
      case 'users':
        return { title: t('users.title'), subtitle: t('users.subtitle') };
      case 'settings':
        return { title: t('settings.title'), subtitle: t('settings.subtitle') };
      case 'about':
        return { title: t('about.title'), subtitle: t('about.subtitle') };
      default:
        return { title: 'ELYS', subtitle: '' };
    }
  };

  const headerInfo = getTabHeader();

  const handleGlobalNavigate = (tab: string, filter?: any) => {
    setNavFilter(filter || null);
    setCurrentTab(tab);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-[#e2e8f0] flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setNavFilter(null);
          setCurrentTab(tab);
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Container */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? 'md:ml-[80px]' : 'md:ml-[280px]'
        } ml-0`}
      >
        {/* Top Header */}
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          collapsed={collapsed}
          onOpenMobile={() => setMobileOpen(true)}
          onNavigate={handleGlobalNavigate}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 mt-16 cyber-grid-bg">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardView
                onNavigate={handleGlobalNavigate}
                onOpenNewTask={() => {
                  setSelectedTemplate(null);
                  setNavFilter(null);
                  setCurrentTab('tasks');
                }}
                onOpenNewDestination={() => {
                  setCurrentTab('destinations');
                }}
              />
            )}
            {currentTab === 'tasks' && (
              <TasksView
                prefilledTemplate={selectedTemplate}
                onClearPrefilledTemplate={() => setSelectedTemplate(null)}
                initialSearch={navFilter?.search || ''}
                initialDestinationId={navFilter?.destinationId || ''}
              />
            )}
            {currentTab === 'destinations' && (
              <DestinationsView initialSystemFilter={navFilter?.systemType || ''} />
            )}
            {currentTab === 'templates' && (
              <TemplatesView
                onUseTemplate={(template) => {
                  setSelectedTemplate(template);
                  setCurrentTab('tasks');
                }}
              />
            )}
            {currentTab === 'credentials' && <CredentialsView />}
            {currentTab === 'calendar' && <CalendarView />}
            {currentTab === 'executions' && <ExecutionsView />}
            {currentTab === 'categories' && (
              <CategoriesView
                onSelectSystemCategory={(sysId) => {
                  handleGlobalNavigate('destinations', { systemType: sysId });
                }}
              />
            )}
            {currentTab === 'users' && <UsersView />}
            {currentTab === 'settings' && <SettingsView />}
            {currentTab === 'about' && <AboutView />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
