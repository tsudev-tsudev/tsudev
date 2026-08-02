import React from 'react';
import { Layout } from '../index';

export default {
  title: 'UI/Layout',
  component: Layout,
};

export const Default = () => (
  <Layout>
    <div style={{ padding: 20 }}>
      <h2>Page content</h2>
      <p>This demonstrates the site layout with header and footer.</p>
    </div>
  </Layout>
);
