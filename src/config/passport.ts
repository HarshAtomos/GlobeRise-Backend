import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './env';
import prisma from './database';
import authService from '../services/auth.service';

// JWT Strategy
passport.use(
    new JwtStrategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.jwt.secret,
        },
        async (payload, done) => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: payload.userId },
                });

                if (!user) {
                    return done(null, false);
                }

                return done(null, user);
            } catch (error) {
                return done(error, false);
            }
        }
    )
);

// Local Strategy (Email/Password)
passport.use(
    new LocalStrategy(
        {
            usernameField: 'email',
            passwordField: 'password',
        },
        async (email, password, done) => {
            try {
                const result = await authService.loginWithEmail(email, password);
                // Pass the full result as the user object (we'll handle it in the controller)
                return done(null, result as any);
            } catch (error) {
                return done(null, false, { message: (error as Error).message });
            }
        }
    )
);

// Google OAuth Strategy
if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: config.oauth.google.clientId,
                clientSecret: config.oauth.google.clientSecret,
                callbackURL: config.oauth.google.callbackUrl,
                scope: ['profile', 'email'],
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    if (!email) {
                        return done(new Error('No email found from Google'), false);
                    }

                    const result = await authService.findOrCreateOAuthUser(
                        email,
                        profile.id,
                        'google'
                    );

                    // Pass the full result as the user object (we'll handle it in the controller)
                    return done(null, result as any);
                } catch (error) {
                    return done(error as Error, false);
                }
            }
        )
    );
}

export default passport;