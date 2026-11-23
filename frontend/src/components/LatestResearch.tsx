import React from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { POSTS } from '../research/posts';

export const LatestResearch: React.FC = () => (
  <section aria-labelledby="latest-research" className="space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="latest-research" className="text-xl font-semibold text-gray-900">
        Latest research
      </h2>
      <Link to="/research" className="text-sm font-medium text-primary-600 hover:text-primary-700">
        All research →
      </Link>
    </div>
    <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {POSTS.slice(0, 3).map(post => (
        <li key={post.slug} className="card space-y-2">
          <p className="text-xs text-gray-500">{format(parseISO(post.date), 'MMMM d, yyyy')}</p>
          <h3 className="text-lg font-semibold leading-snug">
            <Link to={`/research/${post.slug}`} className="text-gray-900 hover:text-primary-600">
              {post.title}
            </Link>
          </h3>
          <p className="text-sm text-gray-600">{post.summary}</p>
        </li>
      ))}
    </ul>
  </section>
);
