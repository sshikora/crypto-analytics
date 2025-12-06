import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CryptoCard } from './CryptoCard';
import { Cryptocurrency } from '../types/crypto';

interface SortableCryptoCardProps {
  id: string;
  crypto: Cryptocurrency;
  onClick: () => void;
}

export const SortableCryptoCard: React.FC<SortableCryptoCardProps> = ({ id, crypto, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    setActivatorNodeRef,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      <CryptoCard crypto={crypto} onClick={onClick} />
      {/* Drag handle in top-right corner */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        className="absolute top-2 right-2 p-2 cursor-move bg-white/80 hover:bg-white rounded-md shadow-sm border border-gray-200 hover:border-gray-300 transition-colors"
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-gray-500"
        >
          <path
            d="M5 3.5C5 4.05228 4.55228 4.5 4 4.5C3.44772 4.5 3 4.05228 3 3.5C3 2.94772 3.44772 2.5 4 2.5C4.55228 2.5 5 2.94772 5 3.5Z"
            fill="currentColor"
          />
          <path
            d="M5 8C5 8.55228 4.55228 9 4 9C3.44772 9 3 8.55228 3 8C3 7.44772 3.44772 7 4 7C4.55228 7 5 7.44772 5 8Z"
            fill="currentColor"
          />
          <path
            d="M4 13.5C4.55228 13.5 5 13.0523 5 12.5C5 11.9477 4.55228 11.5 4 11.5C3.44772 11.5 3 11.9477 3 12.5C3 13.0523 3.44772 13.5 4 13.5Z"
            fill="currentColor"
          />
          <path
            d="M9 3.5C9 4.05228 8.55228 4.5 8 4.5C7.44772 4.5 7 4.05228 7 3.5C7 2.94772 7.44772 2.5 8 2.5C8.55228 2.5 9 2.94772 9 3.5Z"
            fill="currentColor"
          />
          <path
            d="M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z"
            fill="currentColor"
          />
          <path
            d="M9 12.5C9 13.0523 8.55228 13.5 8 13.5C7.44772 13.5 7 13.0523 7 12.5C7 11.9477 7.44772 11.5 8 11.5C8.55228 11.5 9 11.9477 9 12.5Z"
            fill="currentColor"
          />
          <path
            d="M12 4.5C12.5523 4.5 13 4.05228 13 3.5C13 2.94772 12.5523 2.5 12 2.5C11.4477 2.5 11 2.94772 11 3.5C11 4.05228 11.4477 4.5 12 4.5Z"
            fill="currentColor"
          />
          <path
            d="M13 8C13 8.55228 12.5523 9 12 9C11.4477 9 11 8.55228 11 8C11 7.44772 11.4477 7 12 7C12.5523 7 13 7.44772 13 8Z"
            fill="currentColor"
          />
          <path
            d="M12 13.5C12.5523 13.5 13 13.0523 13 12.5C13 11.9477 12.5523 11.5 12 11.5C11.4477 11.5 11 11.9477 11 12.5C11 13.0523 11.4477 13.5 12 13.5Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
};
