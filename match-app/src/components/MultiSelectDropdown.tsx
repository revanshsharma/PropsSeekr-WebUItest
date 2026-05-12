import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { pageUi } from '../lib/pageUi';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = "Select...",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0].replace('_', ' ');
    return `${selected.length} Selected`;
  };

  return (
    <div className="flex flex-col space-y-1.5" ref={dropdownRef}>
      <label className={pageUi.label}>{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            pageUi.input,
            'flex items-center justify-between gap-2 text-left',
            isOpen && 'border-primary-500 ring-2 ring-primary-500/20',
            disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed hover:border-slate-200'
          )}
        >
          <span className={cn("truncate", selected.length === 0 ? "text-slate-400" : "text-slate-900")}>
            {getDisplayText()}
          </span>
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl py-2 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className="w-full flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-primary-50 transition-colors"
              >
                <div className={cn(
                  "w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors",
                  selected.includes(option) ? "bg-primary-600 border-primary-600" : "bg-white border-slate-300"
                )}>
                  {selected.includes(option) && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className={cn(selected.includes(option) && "font-bold text-primary-700")}>
                  {option.replace('_', ' ')}
                </span>
              </button>
            ))}
            {selected.length > 0 && (
              <div className="border-t border-slate-100 mt-2 pt-2 px-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Clear all logic would go here, but for now we'll just handle it in parent if needed
                  }}
                  className="w-full text-center text-xs font-bold text-primary-600 py-1 hover:text-primary-700"
                >
                  {selected.length} items selected
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSelectDropdown;
