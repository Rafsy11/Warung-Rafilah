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
  onAltA?:   () => void;
  onAltC?:   () => void;
  onAltN?:   () => void;
  onAltP?:   () => void;
  onAltS?:   () => void;
  onAsterisk?: () => void;
};

/**
 * Mengubah nilai input secara programmatik dengan memicu pembaruan state internal React.
 */
function setInputValueReact(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  const event = new Event('input', { bubbles: true });
  input.dispatchEvent(event);
}

export function useGlobalHotkeys(config: HotkeysConfig) {
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // State pelacakan interval untuk mendeteksi scanner
  const lastKeyTimeRef = useRef<number>(0);
  const lastCharRef = useRef<string>('');
  const lastInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const isScanningRef = useRef<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');

      const now = performance.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Ambang batas kecepatan pengetikan scanner (35 milidetik)
      const isRapid = interval < 35;

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
        case '*':
          // Buka laci hanya jika tidak sedang mengetik di input field
          if (!isInputFocused && config.onAsterisk) {
            e.preventDefault();
            config.onAsterisk();
            return;
          }
          break;
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
        if ((e.key === 'a' || e.key === 'A') && config.onAltA) {
          e.preventDefault();
          config.onAltA();
          return;
        }
        if ((e.key === 'c' || e.key === 'C') && config.onAltC) {
          e.preventDefault();
          config.onAltC();
          return;
        }
        if ((e.key === 'n' || e.key === 'N') && config.onAltN) {
          e.preventDefault();
          config.onAltN();
          return;
        }
        if ((e.key === 'p' || e.key === 'P') && config.onAltP) {
          e.preventDefault();
          config.onAltP();
          return;
        }
        if ((e.key === 's' || e.key === 'S') && config.onAltS) {
          e.preventDefault();
          config.onAltS();
          return;
        }
      }

      // Intersepsi pengetikan scanner vs manusia
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isInputFocused) {
          if (isRapid) {
            // Scanner terdeteksi mengetik sangat cepat di dalam input!
            e.preventDefault();

            if (!isScanningRef.current) {
              isScanningRef.current = true;
              
              // Hapus karakter pertama yang terlanjur terketik di input (slipped character)
              if (lastInputRef.current && lastInputRef.current === activeElement && lastCharRef.current) {
                const val = lastInputRef.current.value;
                if (val.endsWith(lastCharRef.current)) {
                  setInputValueReact(lastInputRef.current, val.slice(0, -lastCharRef.current.length));
                }
              }

              // Masukkan karakter pertama dan kedua ke buffer scanner
              bufferRef.current = lastCharRef.current + e.key;
            } else {
              bufferRef.current += e.key;
            }
          } else {
            // Pengetikan manual manusia (lambat)
            isScanningRef.current = false;
            bufferRef.current = '';
            
            // Catat karakter ini sebagai kandidat karakter awal pemindaian scanner
            lastCharRef.current = e.key;
            lastInputRef.current = activeElement;
          }
        } else {
          // Input sedang tidak fokus, kumpulkan langsung ke buffer scanner
          bufferRef.current += e.key;
          isScanningRef.current = true;
        }

        // Reset buffer jika terputus/berhenti mengetik (di atas 50ms berarti bukan scanner)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
          isScanningRef.current = false;
          lastCharRef.current = '';
          lastInputRef.current = null;
        }, 50);

        return;
      }

      // Intersepsi tombol Enter dari Scanner vs Manusia
      if (e.key === 'Enter') {
        if (isScanningRef.current || bufferRef.current.length > 0) {
          if (config.onScan && bufferRef.current.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            config.onScan(bufferRef.current);
            bufferRef.current = '';
            isScanningRef.current = false;
          }
          return;
        }
      }
    };

    // Daftarkan event listener di capture phase (true) untuk mendahului element input browser
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [config]);
}
