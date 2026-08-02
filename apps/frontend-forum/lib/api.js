// Server-side reads for the forum app (getServerSideProps).
const CONTENT = process.env.CONTENT_SERVICE_URL || 'http://localhost:4001';
const USER = process.env.USER_SERVICE_URL || 'http://localhost:4000';

async function getJSON(url, fallback) {
  try {
    const res = await fetch(url);
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
