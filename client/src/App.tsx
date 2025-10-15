import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import BarberDashboard from './pages/BarberDashboard';
import CustomerBooking from './pages/CustomerBooking';

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">Barbearia Galileu</div>
          <nav className="app-nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Agendar corte
            </NavLink>
            <NavLink to="/barbeiro" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Área do barbeiro
            </NavLink>
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<CustomerBooking />} />
            <Route path="/barbeiro" element={<BarberDashboard />} />
          </Routes>
        </main>
        <footer className="app-footer">
          © {new Date().getFullYear()} Barbearia Galileu. Todos os direitos reservados.
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
