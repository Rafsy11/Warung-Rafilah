"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calculator, Delete, Trash2 } from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [shouldReset, setShouldReset] = useState(false);

  const calculate = useCallback((num1: number, operator: string, num2: number): number => {
    switch (operator) {
      case '+': return num1 + num2;
      case '-': return num1 - num2;
      case '*':
      case '×': return num1 * num2;
      case '/':
      case '÷': return num2 !== 0 ? num1 / num2 : 0;
      default: return num2;
    }
  }, []);

  const handleInput = useCallback((val: string) => {
    setDisplay(prev => {
      if (shouldReset) {
        setShouldReset(false);
        return val === '.' ? '0.' : val;
      }
      if (prev === '0' && val !== '.') {
        return val;
      }
      if (val === '.' && prev.includes('.')) {
        return prev;
      }
      // Limit length to prevent overflow
      if (prev.length >= 15) return prev;
      return prev + val;
    });
  }, [shouldReset]);

  const handleOperator = useCallback((op: string) => {
    setShouldReset(true);
    setEquation(prev => {
      // If display has a number and we choose an operator
      const currentVal = Number(display);
      if (!prev) {
        return `${display} ${op}`;
      }
      
      const parts = prev.trim().split(' ');
      if (parts.length === 2) {
        // Evaluate previous step first
        const num1 = Number(parts[0]);
        const prevOp = parts[1];
        const res = calculate(num1, prevOp, currentVal);
        setDisplay(String(res));
        return `${res} ${op}`;
      }
      return `${display} ${op}`;
    });
  }, [display, calculate]);

  const handleEvaluate = useCallback(() => {
    if (!equation) return;
    const parts = equation.trim().split(' ');
    if (parts.length === 2) {
      const num1 = Number(parts[0]);
      const op = parts[1];
      const num2 = Number(display);
      const res = calculate(num1, op, num2);
      
      const formattedRes = Number(res.toFixed(8)); // Avoid floating point issues
      const eqString = `${equation} ${display} =`;
      
      setHistory(prev => [ `${eqString} ${formattedRes}`, ...prev ].slice(0, 10)); // Keep last 10
      setDisplay(String(formattedRes));
      setEquation('');
      setShouldReset(true);
    }
  }, [equation, display, calculate]);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setEquation('');
    setShouldReset(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setDisplay(prev => {
      if (prev.length <= 1 || prev === '0') return '0';
      return prev.slice(0, -1);
    });
  }, []);

  const handlePercentage = useCallback(() => {
    setDisplay(prev => String(Number(prev) / 100));
  }, []);

  const handleToggleSign = useCallback(() => {
    setDisplay(prev => String(Number(prev) * -1));
  }, []);

  // Listen to physical keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Stop events from propagating to POS global hotkeys (like Escape clearing cart, or F-keys switching modes)
      e.stopPropagation();

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleInput(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleInput('.');
      } else if (e.key === '+') {
        e.preventDefault();
        handleOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleOperator('-');
      } else if (e.key === '*') {
        e.preventDefault();
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEvaluate();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        // If display is already 0 and equation is empty, Escape closes the calculator.
        // Otherwise, it clears the current state first.
        if (display === '0' && !equation) {
          onClose();
        } else {
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, display, equation, handleInput, handleOperator, handleEvaluate, handleBackspace, handleClear, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-b from-surface-container to-surface-container-high border border-outline-variant/60 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[500px] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Left Side: History Panel */}
        <div className="flex-1 bg-surface-container-lowest/30 border-r border-outline-variant/50 p-5 flex flex-col gap-3 h-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
            <h3 className="font-bold text-xs tracking-wider text-on-surface-variant uppercase">Riwayat Hitung</h3>
            {history.length > 0 && (
              <button 
                onClick={() => setHistory([])}
                className="text-[10px] font-bold text-error hover:text-error/85 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} />
                HAPUS
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 scrollbar-hide">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-on-surface-variant/40 gap-1.5">
                <Calculator size={20} className="opacity-30" />
                <span>Belum ada riwayat kalkulasi.</span>
              </div>
            ) : (
              history.map((h, idx) => {
                const parts = h.split(' = ');
                return (
                  <div 
                    key={idx} 
                    className="p-3 bg-surface-container-low/40 border border-outline-variant/35 rounded-xl flex flex-col items-end gap-1.5 cursor-pointer hover:bg-surface-container-low transition-colors"
                    onClick={() => {
                      setDisplay(parts[1]);
                      setEquation('');
                      setShouldReset(true);
                    }}
                    title="Salin hasil ke kalkulator"
                  >
                    <span className="text-[10px] text-on-surface-variant/60 font-mono tracking-tight text-right break-all w-full">{parts[0]}</span>
                    <span className="text-sm font-extrabold text-primary font-mono tracking-tight">{parts[1]}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Keypad Panel */}
        <div className="w-[340px] flex flex-col h-full bg-surface-container-lowest/50">
          {/* Header */}
          <div className="px-5 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface-container-highest/10">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-xs font-black tracking-wider text-on-surface">KALKULATOR POS</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-surface-container-highest rounded-full text-on-surface-variant hover:text-on-surface transition-all duration-150 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Screen Display */}
          <div className="p-5 flex flex-col justify-end items-end bg-black/15 border-b border-outline-variant/30 h-28 select-all font-mono">
            {equation && (
              <span className="text-xs text-on-surface-variant/70 tracking-tight font-medium break-all max-w-full truncate">
                {equation}
              </span>
            )}
            <span className="text-3xl font-black text-on-surface tracking-tight mt-1 truncate max-w-full">
              {display.toLocaleString()}
            </span>
          </div>

          {/* Keyboard Grid */}
          <div className="flex-1 p-4 grid grid-cols-4 gap-2 bg-surface-container-lowest/15">
            {/* Row 1 */}
            <button onClick={handleClear} className="h-11 rounded-xl bg-error-container/20 hover:bg-error-container/45 text-error font-bold text-sm transition-all active:scale-95 cursor-pointer">
              C
            </button>
            <button onClick={handleToggleSign} className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-sm transition-all active:scale-95 cursor-pointer">
              +/-
            </button>
            <button onClick={handlePercentage} className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-sm transition-all active:scale-95 cursor-pointer">
              %
            </button>
            <button onClick={() => handleOperator('÷')} className="h-11 rounded-xl bg-secondary-container/50 hover:bg-secondary-container text-secondary font-bold text-base transition-all active:scale-95 cursor-pointer">
              ÷
            </button>

            {/* Row 2 */}
            <button onClick={() => handleInput('7')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              7
            </button>
            <button onClick={() => handleInput('8')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              8
            </button>
            <button onClick={() => handleInput('9')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              9
            </button>
            <button onClick={() => handleOperator('×')} className="h-11 rounded-xl bg-secondary-container/50 hover:bg-secondary-container text-secondary font-bold text-base transition-all active:scale-95 cursor-pointer">
              ×
            </button>

            {/* Row 3 */}
            <button onClick={() => handleInput('4')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              4
            </button>
            <button onClick={() => handleInput('5')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              5
            </button>
            <button onClick={() => handleInput('6')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              6
            </button>
            <button onClick={() => handleOperator('-')} className="h-11 rounded-xl bg-secondary-container/50 hover:bg-secondary-container text-secondary font-bold text-base transition-all active:scale-95 cursor-pointer">
              -
            </button>

            {/* Row 4 */}
            <button onClick={() => handleInput('1')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              1
            </button>
            <button onClick={() => handleInput('2')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              2
            </button>
            <button onClick={() => handleInput('3')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              3
            </button>
            <button onClick={() => handleOperator('+')} className="h-11 rounded-xl bg-secondary-container/50 hover:bg-secondary-container text-secondary font-bold text-base transition-all active:scale-95 cursor-pointer">
              +
            </button>

            {/* Row 5 */}
            <button onClick={() => handleInput('0')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              0
            </button>
            <button onClick={() => handleInput('.')} className="h-11 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-base font-mono shadow-sm transition-all active:scale-95 cursor-pointer">
              .
            </button>
            <button onClick={handleBackspace} className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant flex items-center justify-center transition-all active:scale-95 cursor-pointer">
              <Delete size={18} />
            </button>
            <button onClick={handleEvaluate} className="h-11 rounded-xl bg-primary hover:bg-primary/95 text-on-primary font-bold text-lg shadow-md transition-all active:scale-95 cursor-pointer">
              =
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
