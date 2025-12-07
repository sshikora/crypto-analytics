import posthog from 'posthog-js';

export const initPostHog = () => {
  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not configured');
    return null;
  }

  posthog.init(apiKey, {
    api_host: host,
    person_profiles: 'identified_only',
    capture_pageview: false, // We'll capture manually for better control
    capture_pageleave: true,
    autocapture: {
      dom_event_allowlist: ['click', 'change', 'submit'],
      url_allowlist: ['cryptoquantlab.com'],
    },
  });

  return posthog;
};

export { posthog };
