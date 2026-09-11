# Security notes

## Secrets

- Never commit `.env` files or API keys.
- `LOVABLE_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only secrets.
- Supabase publishable keys may appear in client applications, but keeping them in environment files is preferred for clean repository hygiene.
- Use `.env.example` as the template for local configuration.

## Reporting a vulnerability

Please do not publish sensitive vulnerability details in a public issue. Contact the project owner privately with reproduction steps and affected files.
