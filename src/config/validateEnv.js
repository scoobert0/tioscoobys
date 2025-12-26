const envalid = require('envalid');
const { str, num, port } = envalid;

function validateEnv() {
  envalid.cleanEnv(process.env, {
    NODE_ENV: str({
      choices: ['development', 'test', 'production'],
      default: 'development',
    }),
    PORT: port({ default: 3000 }),
    HOST: str({ default: '0.0.0.0' }),
    API_KEY: str(), // Required string
    SESSION_SECRET: str(), // Required string, custom length check in reporter
    DB_PATHS: str(), // Required string, defaults provided by .env.example
    CACHE_TTL_SECONDS: num({ default: 60 }),
    REDIS_URL: str({ default: undefined }), // Optional Redis URL
  }, {
    reporter: ({ errors }) => {
      if (Object.keys(errors).length > 0) {
        console.error('❌ Invalid environment variables:');
        for (const [key, err] of Object.entries(errors)) {
          // Custom check for SESSION_SECRET length in production
          if (key === 'SESSION_SECRET' && process.env.NODE_ENV === 'production' && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
            console.error(`  - ${key}: SESSION_SECRET must be at least 32 characters long in production.`);
          } else {
            console.error(`  - ${key}: ${err}`);
          }
        }
        process.exit(1);
      } else if (process.env.NODE_ENV === 'production' && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
        // This handles the case where envalid passes but SESSION_SECRET is too short
        console.error('❌ Invalid environment variables:');
        console.error('  - SESSION_SECRET: SESSION_SECRET must be at least 32 characters long in production.');
        process.exit(1);
      }
    },
  });
}

module.exports = validateEnv;
