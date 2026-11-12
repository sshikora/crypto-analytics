import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { SEO } from '../components/SEO';
import { POSTS } from '../research/posts';

export const Research = () => (
  <>
    <SEO
      title="Research | CryptoQuantLab"
      description="Studies behind CryptoQuantLab's models: what was tested, how, and what it changed on the site."
      canonicalUrl="/research"
    />
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Research</h1>
        <p className="text-gray-600">
          Studies behind the models on this site: what was tested, how, and what it changed. Each links to a notebook you
          can rerun.
        </p>
      </div>
      <ul className="space-y-4">
        {POSTS.map(post => (
          <li key={post.slug} className="card space-y-1">
            <p className="text-xs text-gray-500">{format(parseISO(post.date), 'MMMM d, yyyy')}</p>
            <h2 className="text-xl font-semibold">
              <Link to={`/research/${post.slug}`} className="text-gray-900 hover:text-primary-600">
                {post.title}
              </Link>
            </h2>
            <p className="text-gray-600">{post.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  </>
);
