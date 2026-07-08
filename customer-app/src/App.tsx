import { AddToHomescreenPrompt } from './components/AddToHomescreenPrompt';
import { AppUnavailableScreen } from './components/AppUnavailableScreen';
import CustomerBooking from './pages/CustomerBooking';

const APP_UNAVAILABLE = false;

function App() {
  if (APP_UNAVAILABLE) {
    return <AppUnavailableScreen />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Barbearia De David</div>
      </header>
      <main className="app-main">
        <AddToHomescreenPrompt />
        <CustomerBooking />
      </main>
      <footer className="app-footer">
        © {new Date().getFullYear()} Barbearia De David. Todos os direitos reservados.
      </footer>
    </div>
  );
}

export default App;
