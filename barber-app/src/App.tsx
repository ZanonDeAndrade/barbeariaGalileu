import BarberDashboard from './pages/BarberDashboard';

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Barbearia Galileu</div>
        <div className="page-subtitle" style={{ marginBottom: 0 }}>
          Painel interno do barbeiro
        </div>
      </header>
      <main className="app-main">
        <BarberDashboard />
      </main>
      <footer className="app-footer">
        © {new Date().getFullYear()} Barbearia Galileu. Uso restrito ao time interno.
      </footer>
    </div>
  );
}

export default App;
