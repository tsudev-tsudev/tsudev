import React from 'react';

export const Article = ({ title, author, date, content, toc = null }) => (
  <article className="bg-panel rounded-xl p-6">
    <header className="mb-4">
      <h1 className="text-2xl font-bold text-ink mb-1">{title}</h1>
      <div className="text-sm text-muted">
        {author} — {date}
      </div>
    </header>
    <section className="prose max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    {toc ? <aside className="mt-6 p-4 bg-panel2 rounded-lg">{toc}</aside> : null}
  </article>
);

export default Article;
