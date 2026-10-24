import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../services/analytics';

export interface MetricInfo {
  model: string;
  window: string;
  assumptions: string[];
  validation?: string;
}

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  info?: MetricInfo;
  methodologyHref?: string;
  valueClassName?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  description,
  info,
  methodologyHref,
  valueClassName = 'text-gray-900',
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!infoOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInfoOpen(false);
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setInfoOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [infoOpen]);

  const toggleInfo = () => {
    if (!infoOpen && info) {
      track('view_model', { model: info.model, metric: label });
    }
    setInfoOpen(open => !open);
  };

  return (
    <div ref={container} className="relative bg-gray-50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-gray-500">{label}</p>
        {info && (
          <button
            type="button"
            onClick={toggleInfo}
            aria-expanded={infoOpen}
            aria-controls={popoverId}
            aria-label={`About ${label}`}
            className="text-gray-400 hover:text-gray-600 leading-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>
      <p className={`text-lg font-semibold ${valueClassName}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>

      {info && infoOpen && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`About ${label}`}
          className="absolute z-10 left-0 right-0 top-full mt-1 min-w-[16rem] bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-600 space-y-2"
        >
          <p><span className="font-medium text-gray-900">Model:</span> {info.model}</p>
          <p><span className="font-medium text-gray-900">Data:</span> {info.window}</p>
          <div>
            <p className="font-medium text-gray-900">Assumptions</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {info.assumptions.map(assumption => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </div>
          {info.validation && (
            <p><span className="font-medium text-gray-900">Validation:</span> {info.validation}</p>
          )}
          {methodologyHref && (
            <Link to={methodologyHref} className="inline-block text-primary-600 hover:text-primary-700 font-medium">
              Methodology →
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
