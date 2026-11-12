import { Suspense, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { SEO } from '../components/SEO';
import { Disclaimer } from '../components/Disclaimer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { findPost } from '../research/posts';
import { track } from '../services/analytics';

export const ResearchPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = findPost(slug);

  useEffect(() => {
    if (post) track('view_research', { slug: post.slug });
  }, [post]);

  if (!post) {
    return (
      <div className="card text-center space-y-2">
        <p className="text-gray-700">No research post at this address.</p>
        <Link to="/research" className="text-primary-600 hover:text-primary-700">
          All research
        </Link>
      </div>
    );
  }

  const { Body } = post;
  return (
    <>
      <SEO
        title={`${post.title} | CryptoQuantLab`}
        description={post.summary}
        canonicalUrl={`/research/${post.slug}`}
        ogType="article"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.summary,
          datePublished: post.date,
          url: `https://cryptoquantlab.com/research/${post.slug}`,
        }}
      />
      <article className="max-w-3xl space-y-6">
        <div className="space-y-2">
          <Link to="/research" className="text-sm text-primary-600 hover:text-primary-700">
            ← Research
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{post.title}</h1>
          <p className="text-sm text-gray-500">{format(parseISO(post.date), 'MMMM d, yyyy')}</p>
          <Disclaimer />
        </div>
        <Suspense fallback={<LoadingSpinner />}>
          <Body />
        </Suspense>
      </article>
    </>
  );
};
