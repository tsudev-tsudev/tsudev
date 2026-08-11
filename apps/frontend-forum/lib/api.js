// Server-side reads for the forum app (getServerSideProps).
import { CONTENT, USER, internalHeaders } from './services';

async function getJSON(url, fallback) {
  try {
    const res = await fetch(url, { headers: internalHeaders() });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

export const forumApi = {
  categories: () => getJSON(`${CONTENT}/api/forum/categories`, []),
  board: (slug) => getJSON(`${CONTENT}/api/forum/boards/${slug}`, null),
  thread: (id) => getJSON(`${CONTENT}/api/forum/threads/${id}`, null),
  members: (limit = 8) => getJSON(`${USER}/api/users?limit=${limit}`, []),
};

export default forumApi;
