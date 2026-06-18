export interface NewsPost {
  slug: string;
  title: string;
  date: string; // ISO
  tag: 'release' | 'patch' | 'devlog';
  excerpt: string;
  body: string[]; // paragraphs (plain text, sanitized at render)
}

/** v1: news come from a static JSON file in /public/data. v2 swaps this for a
 *  Supabase query behind the same interface. */
class NewsServiceImpl {
  private cache: NewsPost[] | null = null;

  async list(): Promise<NewsPost[]> {
    if (this.cache) return this.cache;
    try {
      const res = await fetch('/data/news/index.json');
      if (!res.ok) throw new Error(String(res.status));
      const posts = (await res.json()) as NewsPost[];
      this.cache = posts.sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  async get(slug: string): Promise<NewsPost | null> {
    const posts = await this.list();
    return posts.find((p) => p.slug === slug) ?? null;
  }
}

export const NewsService = new NewsServiceImpl();
