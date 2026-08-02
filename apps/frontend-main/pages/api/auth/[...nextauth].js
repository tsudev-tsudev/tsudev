require('dotenv').config();
import NextAuth from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import CredentialsProvider from 'next-auth/providers/credentials';

const providers = [];

// Add a test-only credentials provider when running E2E in CI/docker.
if (process.env.E2E_BYPASS_KEYCLOAK === '1') {
  providers.push(
    CredentialsProvider({
      id: 'e2e-dev',
      name: 'E2E-Dev',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials || !credentials.username) return null;
        // Dev-only: accept any username with the shared dev password so you can
        // sign in as seeded accounts (e.g. `tsudev` admin) to test roles/mod tools.
        const okPass = process.env.E2E_PASS || 'devpass';
        if (credentials.password !== okPass) return null;
        return {
          id: credentials.username,
          name: credentials.username,
          email: `${credentials.username}@tsudev.local`,
        };
      },
    })
  );
}

// Always include Keycloak provider (so dev UI still shows it)
providers.push(
  KeycloakProvider({
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    issuer: process.env.KEYCLOAK_ISSUER,
  })
);

export default NextAuth({
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  debug: process.env.NODE_ENV !== 'production',
  cookies: {
    sessionToken: {
      name: process.env.NEXTAUTH_COOKIE_NAME || 'next-auth.session-token',
      options: {
        domain: process.env.NEXTAUTH_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN || undefined,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
});
