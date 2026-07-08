import logoUrl from '../assets/Logo.jpg';
import './AppUnavailableScreen.css';

export function AppUnavailableScreen() {
  return (
    <main className="app-unavailable" aria-labelledby="app-unavailable-title">
      <section className="app-unavailable__content">
        <img className="app-unavailable__logo" src={logoUrl} alt="Logo da barbearia" />
        <div className="app-unavailable__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" role="img">
            <path
              d="M14.7 6.3a4.2 4.2 0 0 0-5.05 5.05l-4.9 4.9a2.12 2.12 0 0 0 3 3l4.9-4.9A4.2 4.2 0 0 0 17.7 9.3l-2.85 2.85-3-3L14.7 6.3Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="m6.35 17.65.01.01"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1 className="app-unavailable__title" id="app-unavailable-title">
          Aplicativo indisponível
        </h1>
        <p className="app-unavailable__thanks">Agradecemos a compreensão.</p>
      </section>
    </main>
  );
}
