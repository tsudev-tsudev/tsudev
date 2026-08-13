// Server-side data helpers for frontend-main.
// In dev these hit the local microservices; override via env in other envs.
import { CONTENT, internalHeaders } from './services';

async function getJSON(url, fallback) {
  try {
    const res = await fetch(url, {
      headers: { ...internalHeaders(), 'x-dev-user': 'tsudev', 'x-dev-roles': 'admin' },
    });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

export const api = {
  posts: (limit = 6) => getJSON(`${CONTENT}/api/posts?limit=${limit}`, []),
  post: (slug) => getJSON(`${CONTENT}/api/posts/${slug}`, null),
  docs: () => getJSON(`${CONTENT}/api/docs`, []),
  doc: (slug) => getJSON(`${CONTENT}/api/docs/${slug}`, null),
  projects: (limit = 50) => getJSON(`${CONTENT}/api/projects?limit=${limit}`, []),
  project: (slug) => getJSON(`${CONTENT}/api/projects/${slug}`, null),
};

export default api;
