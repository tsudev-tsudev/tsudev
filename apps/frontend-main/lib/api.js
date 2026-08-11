// Server-side data helpers for frontend-main.
// In dev these hit the local microservices; override via env in other envs.
import { CONTENT, USER, internalHeaders } from './services';

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
  categories: () => getJSON(`${CONTENT}/api/forum/categories`, []),
  board: (slug) => getJSON(`${CONTENT}/api/forum/boards/${slug}`, null),
  members: (limit = 5) => getJSON(`${USER}/api/users?limit=${limit}`, []),
  member: (username) => getJSON(`${USER}/api/users/${username}`, null),
  listings: (status = 'ACTIVE') => getJSON(`${CONTENT}/api/market/listings?status=${status}`, []),
  listing: (id) => getJSON(`${CONTENT}/api/market/listings/${id}`, null),
};

export default api;
