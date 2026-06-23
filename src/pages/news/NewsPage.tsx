import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NewsService, type NewsPost } from '@/services/news/NewsService';
import { SectionTitle } from '@/ui/primitives/SectionTitle';
import { Tag } from '@/ui/primitives/Tag';
import { Skeleton } from '@/ui/feedback/Skeleton';

export function NewsPage() {
  const { slug } = useParams<{ slug?: string }>();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [article, setArticle] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (slug) {
      void NewsService.get(slug).then((p) => {
        setArticle(p);
        setLoading(false);
      });
    } else {
      void NewsService.list().then((p) => {
        setPosts(p);
        setLoading(false);
      });
    }
  }, [slug]);

  if (loading)
    return slug ? (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    ) : (
      <div>
        <SectionTitle eyebrow="журнал" title="Новости и патчноуты" />
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );

  if (slug) {
    if (!article)
      return (
        <div className="panel p-8 text-center">
          <p className="text-muted">Новость не найдена.</p>
          <Link to="/news" className="mt-3 inline-block text-accent hover:underline">
            ← ко всем новостям
          </Link>
        </div>
      );
    return (
      <article className="mx-auto max-w-3xl">
        <Link to="/news" className="font-mono text-sm text-accent hover:underline">
          ← новости
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <Tag tone="accent">{article.tag}</Tag>
          <span className="font-mono text-xs text-muted">{article.date.slice(0, 10)}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink neon-text">{article.title}</h1>
        <div className="panel-glass mt-6 space-y-4 p-6 leading-relaxed text-muted">
          {article.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>
    );
  }

  return (
    <div>
      <SectionTitle eyebrow="журнал" title="Новости и патчноуты" />
      <div className="grid gap-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/news/${post.slug}`}
            className="panel p-5 transition-all hover:border-accent/40"
          >
            <div className="flex items-center gap-3">
              <Tag tone="accent">{post.tag}</Tag>
              <span className="ml-auto font-mono text-[0.65rem] text-muted">{post.date.slice(0, 10)}</span>
            </div>
            <h3 className="mt-3 font-display text-lg text-ink">{post.title}</h3>
            <p className="mt-1 text-sm text-muted">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
