import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserById, getUserByUsername } from "./db/index";

export const authOptions: NextAuthOptions = {
	providers: [
		CredentialsProvider({
			name: "credentials",
			credentials: {
				username: { label: "Username", type: "text" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				if (!credentials?.username || !credentials?.password) {
					return null;
				}

				try {
					// Find user by username or email
					const user = await getUserByUsername(credentials.username);

					if (!user) {
						return null;
					}

					// Verify password
					const isPasswordValid = await bcrypt.compare(
						credentials.password,
						user.password
					);
					if (!isPasswordValid) {
						return null;
					}

					return {
						id: user.id.toString(),
						email: user.email,
						name: user.name,
						username: user.username,
						image: user.image,
					};
				} catch (error) {
					console.error("Authentication error:", error);
					return null;
				}
			},
		}),
	],
	callbacks: {
		async session({ session, token }) {
			if (token.sub) {
				try {
					const user = await getUserById(Number.parseInt(token.sub));
					if (user) {
						session.user.id = user.id.toString();
						session.user.username = user.username;

						// Optimize: Only include essential permission names, not full objects
						session.user.roles = user.roles.map((role) => ({
							id: role.id,
							name: role.name,
							description: role.description,
							created_at: role.createdAt,
						}));

						// Only store permission names to reduce size
						session.user.permissions = user.permissions.map((permission) => ({
							id: permission.id,
							name: permission.name,
							description: permission.description,
							resource: permission.resource.name,
							action: permission.action.name,
							created_at: permission.createdAt,
						}));

						// Debug logging (only in development)
						if (process.env.NODE_ENV === "development") {
							console.log(
								"Session callback - User permissions count:",
								user.permissions.length
							);
						}
					} else {
						console.warn("User not found in session callback:", token.sub);
					}
				} catch (error) {
					console.error("Error in session callback:", error);
				}
			}
			return session;
		},
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.username = user.username;
			}

			// Optimize: Store minimal data in JWT for middleware
			if (token.sub) {
				try {
					const userData = await getUserById(Number.parseInt(token.sub));
					if (userData) {
						// Only store permission names for middleware, not full objects
						token.permissions = userData.permissions.map((p) => ({
							name: p.name,
						}));
						token.roles = userData.roles.map((r) => ({ name: r.name }));
					}
				} catch (error) {
					console.error("Error adding permissions to JWT:", error);
				}
			}

			return token;
		},
	},
	pages: {
		signIn: "/login",
		error: "/login",
	},
	session: {
		strategy: "jwt",
		maxAge: 24 * 60 * 60, // 24 hours
	},
	jwt: {
		maxAge: 24 * 60 * 60, // 24 hours
	},
	secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
};
