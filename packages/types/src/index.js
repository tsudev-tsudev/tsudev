'use strict';
// Shared constants & lightweight contract helpers across services and frontends.

const ROLES = ['GUEST', 'MEMBER', 'VIP', 'MODERATOR', 'ADMIN'];
const ROLE_RANK = { GUEST: 0, MEMBER: 1, VIP: 2, MODERATOR: 3, ADMIN: 4 };

function hasAtLeastRole(userRole, required) {
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[required] ?? 0);
}

module.exports = { ROLES, ROLE_RANK, hasAtLeastRole };
