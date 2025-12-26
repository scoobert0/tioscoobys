const bcrypt = require('bcryptjs');

// Hash cost - higher is more secure (and slower)
const SALT_ROUNDS = 10;

module.exports = (saasDbManager) => {
    const simpleAuth = {
        // Middleware to protect routes
        async requireAuth(request, reply) {
            if (!request.session.user || !request.session.user.username) {
                return reply.redirect('/login');
            }
        },

        // Handle user registration
        async handleRegister(request, reply) {
            const { username, password, password_confirm } = request.body;

            if (!username || !password || !password_confirm) {
                return reply.redirect('/register?error=All+fields+are+required.');
            }

            if (password !== password_confirm) {
                return reply.redirect('/register?error=Passwords+do+not+match.');
            }

            const existingUser = await saasDbManager.findUserByUsername(username);
            if (existingUser) {
                return reply.redirect('/register?error=Username+already+exists.');
            }

            try {
                const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
                await saasDbManager.createUser(username, passwordHash, 'user'); // Default role 'user'
                return reply.redirect('/login?message=Registration+successful.+Please+log+in.');
            } catch (error) {
                request.log.error(error, 'Error during user registration');
                return reply.redirect('/register?error=An+unexpected+error+occurred.');
            }
        },

        // Handle user login
        async handleLogin(request, reply) {
            const { username, password } = request.body;

            if (!username || !password) {
                return reply.redirect('/login?error=Invalid+username+or+password');
            }

            const user = await saasDbManager.findUserByUsername(username);

            if (!user) {
                return reply.redirect('/login?error=Invalid+username+or+password');
            }

            const match = await bcrypt.compare(password, user.password_hash);

            if (match) {
                // Manter simples, apenas o username na sessão
                request.session.user = {
                    username: user.username,
                    role: user.role
                };
                await request.session.save();
                return reply.redirect('/dashboard');
            } else {
                return reply.redirect('/login?error=Invalid+username+or+password');
            }
        }
    };
    return simpleAuth;
};
