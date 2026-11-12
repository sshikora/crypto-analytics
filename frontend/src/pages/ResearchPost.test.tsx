import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useQuery } from '@apollo/client';
import { Research } from './Research';
import { ResearchPost } from './ResearchPost';
import { track } from '../services/analytics';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));
vi.mock('@apollo/client', async importOriginal => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: vi.fn(() => ({ data: undefined })),
}));

function renderAt(path: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/research" element={<Research />} />
          <Route path="/research/:slug" element={<ResearchPost />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('Research', () => {
  it('lists each post with a link to it', () => {
    renderAt('/research');
    expect(screen.getByRole('link', { name: 'Do Moving-Average Crossovers Time Crypto?' })).toHaveAttribute(
      'href',
      '/research/moving-average-crossovers'
    );
  });
});

describe('ResearchPost', () => {
  it('loads the post body and records the view', async () => {
    renderAt('/research/moving-average-crossovers');
    expect(screen.getByRole('heading', { level: 1, name: 'Do Moving-Average Crossovers Time Crypto?' })).toBeInTheDocument();
    expect(await screen.findByText('Why the best backtest lies', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('view_research', { slug: 'moving-average-crossovers' });
    expect(useQuery).toHaveBeenCalled();
  });

  it('says so for an unknown post', () => {
    renderAt('/research/no-such-post');
    expect(screen.getByText('No research post at this address.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All research' })).toHaveAttribute('href', '/research');
  });
});
