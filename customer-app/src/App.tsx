import { AddToHomescreenPrompt } from './components/AddToHomescreenPrompt';
import CustomerBooking from './pages/CustomerBooking';

function App() {
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
        <div>© {new Date().getFullYear()} Barbearia De David. Todos os direitos reservados.</div>
        <a
          className="app-footer-credit"
          href="https://www.instagram.com/arthurzanon.dev/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Desenvolvido por Zanon de Andrade Softwares - CNPJ: 57.971.378/0001-50
        </a>
      </footer>
    </div>
  );
}

export default App;
