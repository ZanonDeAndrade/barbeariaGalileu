import { format } from 'date-fns';
import { useState } from 'react';
import { AddToHomescreenPrompt } from './components/AddToHomescreenPrompt';
import { AppUnavailableScreen } from './components/AppUnavailableScreen';
import BarberDashboard from './pages/BarberDashboard';
import BlockSchedulePage from './pages/BlockSchedulePage';
import MonthlyMetricsPage from './pages/MonthlyMetricsPage';

type ActivePage = 'dashboard' | 'block' | 'monthly-metrics';

const APP_UNAVAILABLE = false;
const today = format(new Date(), 'yyyy-MM-dd');

function getInitialDate(): string {
  if (typeof window === 'undefined') return today;
  try {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam;
    }
  } catch {
    // ignore
  }
  return today;
}

function AvailableApp() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(getInitialDate);

  const handleNavigateToBlocks = () => setActivePage('block');
  const handleNavigateToMonthlyMetrics = () => setActivePage('monthly-metrics');
  const handleNavigateToDashboard = () => setActivePage('dashboard');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Barbearia De David</div>
        <div className="page-subtitle" style={{ marginBottom: 0 }}>
          Painel interno do barbeiro
        </div>
      </header>
      <main className="app-main">
        <AddToHomescreenPrompt />
        {activePage === 'dashboard' ? (
          <BarberDashboard
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            onNavigateToBlocks={handleNavigateToBlocks}
            onNavigateToMonthlyMetrics={handleNavigateToMonthlyMetrics}
          />
        ) : activePage === 'block' ? (
          <BlockSchedulePage
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            onBack={handleNavigateToDashboard}
          />
        ) : (
          <MonthlyMetricsPage defaultMonth={selectedDate.slice(0, 7)} onBack={handleNavigateToDashboard} />
        )}
      </main>
      <footer className="app-footer">
        © {new Date().getFullYear()} Barbearia De David. Uso restrito ao time interno.
      </footer>
    </div>
  );
}

function App() {
  return APP_UNAVAILABLE ? <AppUnavailableScreen /> : <AvailableApp />;
}

export default App;
