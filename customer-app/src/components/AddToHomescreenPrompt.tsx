import { useEffect, useMemo, useState } from 'react';

function detectPlatform(userAgent: string) {
  const normalized = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(normalized)) {
    return 'ios';
  }
  if (/android/.test(normalized)) {
    return 'android';
  }
  return 'other';
}

const STEP_ICONS = {
  share: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M12 3.25a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06L11.25 11.2V4a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
      <path
        d="M6.75 13a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 0-1.5 0v3.75H7.5V13.75A.75.75 0 0 0 6.75 13Z"
        fill="currentColor"
      />
    </svg>
  ),
  menu: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M5.25 7.5h13.5a.75.75 0 0 0 0-1.5H5.25a.75.75 0 0 0 0 1.5Zm0 5h13.5a.75.75 0 0 0 0-1.5H5.25a.75.75 0 0 0 0 1.5Zm0 5h13.5a.75.75 0 0 0 0-1.5H5.25a.75.75 0 0 0 0 1.5Z"
        fill="currentColor"
      />
    </svg>
  ),
  home: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M11.47 3.22a.75.75 0 0 1 1.06 0l7.25 7.25a.75.75 0 1 1-1.06 1.06l-.22-.22V19a2 2 0 0 1-2 2h-3.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-2a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75H7.5a2 2 0 0 1-2-2v-7.69l-.22.22a.75.75 0 1 1-1.06-1.06l7.25-7.25Z"
        fill="currentColor"
      />
    </svg>
  ),
} as const;

type StepIconKey = keyof typeof STEP_ICONS;

type InstructionSet = {
  title: string;
  subtitle: string;
  steps: Array<{ icon: StepIconKey; description: string }>;
};

export function AddToHomescreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // @ts-expect-error - standalone é exposto apenas no Safari iOS
      window.navigator.standalone === true;

    if (isStandalone) {
      return;
    }

    const detected = detectPlatform(window.navigator.userAgent);

    if (detected === 'ios' || detected === 'android') {
      setPlatform(detected);
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
  };

  const instructions = useMemo<InstructionSet | null>(() => {
    if (platform === 'ios') {
      return {
        title: 'Adicione à tela inicial',
        subtitle: 'Tenha acesso direto aos agendamentos pela tela inicial do seu iPhone ou iPad.',
        steps: [
          { icon: 'share', description: 'Toque no botão Compartilhar na barra inferior.' },
          { icon: 'home', description: 'Escolha “Adicionar à Tela de Início” e confirme.' },
        ],
      };
    }

    if (platform === 'android') {
      return {
        title: 'Instale o atalho',
        subtitle: 'Crie um atalho na tela inicial do Android e abra o app como se fosse nativo.',
        steps: [
          { icon: 'menu', description: 'Abra o menu do navegador (⋮).' },
          { icon: 'home', description: 'Selecione “Adicionar à tela inicial” e toque em Adicionar.' },
        ],
      };
    }

    return null;
  }, [platform]);

  if (!visible || !instructions) {
    return null;
  }

  return (
    <div className="a2hs-banner" role="alert">
      <div className="a2hs-header">
        <div className="a2hs-brand">
          <div className="a2hs-brand-copy">
            <span className="a2hs-brand-name">Barbearia De David</span>
            <span className="a2hs-brand-tagline">Agende em poucos toques</span>
          </div>
        </div>
        <button type="button" className="a2hs-dismiss" onClick={handleDismiss} aria-label="Fechar aviso">
          ×
        </button>
      </div>
      <div className="a2hs-content">
        <strong>{instructions.title}</strong>
        <p>{instructions.subtitle}</p>
        <ul className="a2hs-steps">
          {instructions.steps.map((step, index) => (
            <li key={index}>
              <span className="a2hs-step-icon">{STEP_ICONS[step.icon]}</span>
              <span className="a2hs-step-text">{step.description}</span>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="a2hs-close" onClick={handleDismiss}>
        Ok, vou fazer depois
      </button>
    </div>
  );
}
