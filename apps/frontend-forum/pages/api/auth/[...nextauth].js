require('dotenv').config();
import NextAuth from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import CredentialsProvider from 'next-auth/providers/credentials';

const providers = [];

// Dev/E2E credentials login (no Keycloak needed) when E2E_BYPASS_KEYCLOAK=1.
if (process.env.E2E_BYPASS_KEYCLOAK === '1') {
  providers.push(
    CredentialsProvider({
      id: 'e2e-dev',
      name: 'Tài khoản dev',
      credentials: {
        username: { label: 'Tên đăng nhập', type: 'text' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials || !credentials.username) return null;
        // Dev-only: any username with the shared dev password (E2E_BYPASS_KEYCLOAK).
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
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.name = user.name || token.name;
      return token;
    },
  },
});
