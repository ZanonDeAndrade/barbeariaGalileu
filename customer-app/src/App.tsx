import CustomerBooking from './pages/CustomerBooking';

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Barbearia Galileu</div>
      </header>
      <main className="app-main">
        <CustomerBooking />
      </main>
      <footer className="app-footer">
        © {new Date().getFullYear()} Barbearia Galileu. Todos os direitos reservados.
      </footer>
    </div>
  );
}

export default App;
