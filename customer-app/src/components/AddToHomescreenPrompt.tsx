import { useEffect, useState } from 'react';

const STORAGE_KEY = 'a2hs_prompt_dismissed';

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

export function AddToHomescreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

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

    if (window.localStorage.getItem(STORAGE_KEY)) {
      return;
    }

    const platform = detectPlatform(window.navigator.userAgent);

    if (platform === 'ios') {
      setMessage(
        'No iPhone ou iPad, toque no botão Compartilhar e escolha "Adicionar à Tela de Início" para salvar o atalho.',
      );
      setVisible(true);
    } else if (platform === 'android') {
      setMessage(
        'No Android, toque no menu ⋮ do navegador e selecione "Adicionar à tela inicial" para criar o atalho.',
      );
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="a2hs-banner" role="alert">
      <div className="a2hs-content">
        <strong>Adicione à tela inicial</strong>
        <p>{message}</p>
      </div>
      <button type="button" className="a2hs-dismiss" onClick={handleDismiss} aria-label="Dispensar aviso">
        ×
      </button>
    </div>
  );
}
