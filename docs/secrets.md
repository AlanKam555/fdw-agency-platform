# Secrets

Production (`NODE_ENV=production`) refuses to start when any of these are missing, shorter than 32 bytes, or equal to a value that has been published in this repository:

- `AUTH_SECRET`
- `CRON_SECRET`
- `FIELD_ENCRYPTION_KEY`, or each entry in `FIELD_ENCRYPTION_KEYS`
- `TOTP_ENCRYPTION_KEY` (required, and it must not equal a field key)

Generate a set locally:

```bash
npm run secrets:generate
```

The command prints `KEY=value` lines and nothing else. Paste them into the host environment. Do not commit them.

`AUTH_SECRET` is the root for HKDF purpose keys: session cookies, document links, unsubscribe links, reminder recipient hashes, and email confirmation. Rotating it signs everyone out and invalidates new links. Old unsubscribe links and old testimonial share links still verify until that rotation. Document links last five minutes and use only the new key.

Field ciphertext is `v2:<key id>:...`. Older `v1:` rows decrypt with key id `v1`. Keep retired keys in `FIELD_ENCRYPTION_KEYS` until you run:

```bash
npm run secrets:reencrypt
```

That rewrites passport, FIN, medical, and NRIC values to the active field key, and TOTP secrets to `TOTP_ENCRYPTION_KEY`. It prints counts, not the values.

Docker Compose leaves the secret variables empty. When `NODE_ENV` is not `production`, `secrets-init` writes random values to a volume and the app process loads them before `next start`. Setting `NODE_ENV=production` skips that file. A published default in the environment is not replaced, and the process exits.

Migrations are a separate Compose service. The app container does not run them on start.
