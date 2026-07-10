import { useEffect, useRef } from 'react';

type HotkeysConfig = {
  onScan?:   (barcode: string) => void;
  onF1:      () => void;
  onF2:      () => void;
  onF3?:     () => void;
  onF4?:     () => void;
  onF6?:     () => void;
  onF7?:     () => void;
  onF8?:     () => void;
  onF9?:     () => void;
  onF10?:    () => void;
  onEscape?: () => void;
  onAlt1?:   () => void;
  onAlt2?:   () => void;
  onAlt3?:   () => void;
  onAlt4?:   () => void;
  onAltC?:   () => void;
};

export function useGlobalHotkeys(config: HotkeysConfig) {
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow default behavior for inputs if needed, but usually POS overrides globally.
      // We will avoid preventing default on inputs unless it's a function key or Enter in scanner context.
      
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          config.onF1();
          return;
        case 'F2':
          e.preventDefault();
          config.onF2();
          return;
        case 'F3':
          if (config.onF3) {
            e.preventDefault();
            config.onF3();
          }
          return;
        case 'F4':
          if (config.onF4) {
            e.preventDefault();
            config.onF4();
          }
          return;

        case 'F6':
          if (config.onF6) {
            e.preventDefault();
            config.onF6();
          }
          return;
        case 'F7':
          if (config.onF7) {
            e.preventDefault();
            config.onF7();
          }
          return;
        case 'F8':
          if (config.onF8) {
            e.preventDefault();
            config.onF8();
          }
          return;
        case 'F9':
          if (config.onF9) {
            e.preventDefault();
            config.onF9();
          }
          return;
        case 'F10':
          if (config.onF10) {
            e.preventDefault();
            config.onF10();
          }
          return;
        case 'Escape':
          if (config.onEscape) {
            e.preventDefault();
            config.onEscape();
          }
          return;
      }

      // Handle Alt + combinations
      if (e.altKey) {
        if (e.key === '1' && config.onAlt1) {
          e.preventDefault();
          config.onAlt1();
          return;
        }
        if (e.key === '2' && config.onAlt2) {
          e.preventDefault();
          config.onAlt2();
          return;
        }
        if (e.key === '3' && config.onAlt3) {
          e.preventDefault();
          config.onAlt3();
          return;
        }
        if (e.key === '4' && config.onAlt4) {
          e.preventDefault();
          config.onAlt4();
          return;
        }
        if ((e.key === 'c' || e.key === 'C') && config.onAltC) {
          e.preventDefault();
          config.onAltC();
          return;
        }
      }

      // Abort global scanner buffer if the user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
      if (isInputFocused) return;

      // Scanner Logic
      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0 && config.onScan) {
          e.preventDefault();
          e.stopPropagation(); // Hentikan agar tidak men-trigger event keydown di PaymentPanel
          config.onScan(bufferRef.current);
          bufferRef.current = '';
        }
        return;
      }

      // Append to buffer
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;

        // Reset buffer if typing is slow (not a scanner)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 50);
      }
    };

    // Gunakan capture phase (true) agar interseptor barcode berjalan paling awal
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [config]);
}
