import React from 'react';

type ArticleProps = {
  title?: React.ReactNode;
  author?: React.ReactNode;
  date?: React.ReactNode;
  /** HTML thô, được đổ thẳng qua dangerouslySetInnerHTML - phải đã làm sạch ở nơi gọi. */
  content?: string;
  toc?: React.ReactNode;
};

export const Article = ({ title, author, date, content, toc = null }: ArticleProps) => (
  <article className="bg-surface border border-line rounded-md p-6">
    <header className="mb-4">
      <h1 className="text-2xl font-semibold text-fg mb-1">{title}</h1>
      <div className="text-sm text-fg-muted">
        {author} - {date}
      </div>
    </header>
    <section className="prose max-w-none" dangerouslySetInnerHTML={{ __html: content ?? '' }} />
    {toc ? <aside className="mt-6 p-4 bg-subtle border border-line rounded-md">{toc}</aside> : null}
  </article>
);

export default Article;
