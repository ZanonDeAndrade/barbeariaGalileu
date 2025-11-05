import { format } from 'date-fns';
import { useState } from 'react';
import { AddToHomescreenPrompt } from './components/AddToHomescreenPrompt';
import BarberDashboard from './pages/BarberDashboard';
import BlockSchedulePage from './pages/BlockSchedulePage';

type ActivePage = 'dashboard' | 'block';

const today = format(new Date(), 'yyyy-MM-dd');

function App() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const handleNavigateToBlocks = () => setActivePage('block');
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
          />
        ) : (
          <BlockSchedulePage
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            onBack={handleNavigateToDashboard}
          />
        )}
      </main>
      <footer className="app-footer">
        © {new Date().getFullYear()} Barbearia De David. Uso restrito ao time interno.
      </footer>
    </div>
  );
}

export default App;
