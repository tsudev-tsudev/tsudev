'use strict';
// Shared constants & lightweight contract helpers across services and frontends.

const ROLES = ['GUEST', 'MEMBER', 'VIP', 'MODERATOR', 'ADMIN'];
const ROLE_RANK = { GUEST: 0, MEMBER: 1, VIP: 2, MODERATOR: 3, ADMIN: 4 };

// Reputation deltas for common community actions.
const REP = {
  THREAD_CREATED: 2,
  POST_CREATED: 1,
  UPVOTE_RECEIVED: 5,
  DOWNVOTE_RECEIVED: -2,
  SOLUTION_ACCEPTED: 15,
};

// Auto rank tiers derived from reputation score.
const RANK_TIERS = [
  { min: 0, label: 'Người mới', slug: 'newcomer' },
  { min: 50, label: 'Thành viên', slug: 'member' },
  { min: 200, label: 'Cống hiến', slug: 'contributor' },
  { min: 500, label: 'Kỳ cựu', slug: 'veteran' },
  { min: 1000, label: 'Huyền thoại', slug: 'legend' },
];

function rankFor(reputation) {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (reputation >= t.min) tier = t;
  return tier;
}

function hasAtLeastRole(userRole, required) {
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[required] ?? 0);
}

module.exports = { ROLES, ROLE_RANK, REP, RANK_TIERS, rankFor, hasAtLeastRole };
