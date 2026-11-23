import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { About } from './About';

function renderPage() {
  render(
    <HelmetProvider>
      <MemoryRouter>
        <About />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('About Page', () => {
  it('renders the page title', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'About CryptoQuantLab' })).toBeInTheDocument();
  });

  it('says what the site models and links to how it is checked', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'What it is' })).toBeInTheDocument();
    expect(screen.getByText(/risk analytics site for the 100 largest cryptocurrencies/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Methodology' })).toHaveAttribute('href', '/methodology');
    expect(screen.getByRole('link', { name: 'Research' })).toHaveAttribute('href', '/research');
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/sshikora/crypto-analytics');
  });

  it('says who builds it', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Who builds it' })).toBeInTheDocument();
    expect(screen.getByText(/MS in\s+Computational Finance \(Risk Analysis\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Seth on LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/sethshikora/');
  });

  it('displays the disclaimer section', () => {
    renderPage();

    expect(screen.getByText('Important Disclaimer')).toBeInTheDocument();
    expect(screen.getByText('No Financial Advice')).toBeInTheDocument();
    expect(screen.getByText('Risk Acknowledgment')).toBeInTheDocument();
  });

  it('displays the contact email', () => {
    renderPage();

    expect(screen.getByText('Contact Us')).toBeInTheDocument();
    const emailLink = screen.getByText('support@cryptoquantlab.com');
    expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:support@cryptoquantlab.com');
  });
});
