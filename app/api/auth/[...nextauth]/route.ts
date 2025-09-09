import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

// Hash for "admin" password
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('admin', 10)

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        // Check if username is "admin" and password is "admin"
        if (credentials.username === 'admin' && 
            bcrypt.compareSync(credentials.password, ADMIN_PASSWORD_HASH)) {
          return {
            id: '1',
            name: 'Admin',
            email: 'admin@usdcop-trading.com',
            role: 'admin'
          }
        }

        return null
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET || 'usdcop-trading-secret-key-2024',
})

export { handler as GET, handler as POST }