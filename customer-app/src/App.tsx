import { AddToHomescreenPrompt } from './components/AddToHomescreenPrompt';
import CustomerBooking from './pages/CustomerBooking';

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand">Barbearia De David</div>
          <div className="page-subtitle" style={{ marginBottom: 0 }}>
            Agendamento online de clientes
          </div>
        </div>
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
