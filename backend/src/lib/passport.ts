import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Express } from 'express';
import { prisma } from './db';

export function initializePassport(app: Express) {
  app.use(passport.initialize());

  // ——— Google OAuth 2.0 ———
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google'), undefined);

            // Find or create user
            let user = await prisma.user.findFirst({
              where: {
                OR: [
                  { email },
                  { oauthProvider: 'google', oauthId: profile.id },
                ],
              },
            });

            if (!user) {
              user = await prisma.user.create({
                data: {
                  email,
                  oauthProvider: 'google',
                  oauthId: profile.id,
                },
              });
            } else if (!user.oauthId) {
              // Link OAuth to existing email-registered user
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  oauthProvider: 'google',
                  oauthId: profile.id,
                },
              });
            }

            done(null, user);
          } catch (error) {
            done(error as Error, undefined);
          }
        }
      )
    );
    console.log('[Passport] Google OAuth strategy configured');
  } else {
    console.warn('[Passport] Google OAuth credentials not set — skipping');
  }

  // ——— GitHub OAuth ———
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;

            let user = await prisma.user.findFirst({
              where: {
                OR: [
                  { email },
                  { oauthProvider: 'github', oauthId: profile.id },
                ],
              },
            });

            if (!user) {
              user = await prisma.user.create({
                data: {
                  email,
                  oauthProvider: 'github',
                  oauthId: profile.id,
                },
              });
            } else if (!user.oauthId) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  oauthProvider: 'github',
                  oauthId: profile.id,
                },
              });
            }

            done(null, user);
          } catch (error) {
            done(error as Error, undefined);
          }
        }
      )
    );
    console.log('[Passport] GitHub OAuth strategy configured');
  } else {
    console.warn('[Passport] GitHub OAuth credentials not set — skipping');
  }

  // Serialize/deserialize (stateless JWT, minimal)
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}
