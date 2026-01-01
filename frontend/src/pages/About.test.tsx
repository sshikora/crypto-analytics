import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { About } from './About';

describe('About Page', () => {
  it('renders the page title', () => {
    render(
      <HelmetProvider>
        <About />
      </HelmetProvider>
    );

    expect(screen.getByText('About Crypto Quant Lab')).toBeInTheDocument();
  });

  it('displays the mission section', () => {
    render(
      <HelmetProvider>
        <About />
      </HelmetProvider>
    );

    expect(screen.getByText('Our Mission')).toBeInTheDocument();
    expect(screen.getByText(/Crypto Quant Lab is dedicated to building/)).toBeInTheDocument();
  });

  it('displays the disclaimer section', () => {
    render(
      <HelmetProvider>
        <About />
      </HelmetProvider>
    );

    expect(screen.getByText('Important Disclaimer')).toBeInTheDocument();
    expect(screen.getByText('No Financial Advice')).toBeInTheDocument();
    expect(screen.getByText('Risk Acknowledgment')).toBeInTheDocument();
  });

  it('displays the contact email', () => {
    render(
      <HelmetProvider>
        <About />
      </HelmetProvider>
    );

    expect(screen.getByText('Contact Us')).toBeInTheDocument();
    const emailLink = screen.getByText('support@cryptoquantlab.com');
    expect(emailLink).toBeInTheDocument();
    expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:support@cryptoquantlab.com');
  });
});
