import React from 'react';
import { Article } from '../index';

export default {
  title: 'UI/Article',
  component: Article,
};

const sample = `<p>This is a sample article content. Use <strong>markdown</strong> rendered to HTML for preview.</p><p>List:</p><ul><li>Item one</li><li>Item two</li></ul>`;

export const Default = () => (
  <div className="sb-wrapper">
    <Article title="Sample Article" author="Author Name" date="Apr 15, 2026" content={sample} />
  </div>
);
