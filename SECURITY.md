# Security policy

## Reporting a vulnerability

Please do not report security problems in a public issue or pull request.

Use GitHub's private reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. Include what you found, how to reproduce it, and what an attacker could do with it.

The maintainer will respond as soon as they can and will tell you when a fix ships.

## Supported versions

Only the latest commit on `main` is supported. Fixes are not backported.

## What is in scope

- The Flask backend, the web app, and the Chrome extension in this repository.
- Problems with sign-in, API tokens, note privacy between users, rate limits, and the daily AI allowance.

Reports about a third-party service (YouTube, Google, your AI provider) belong with that service.

## Handling secrets

Never commit `.env` files, API keys or tokens. Personal API tokens are stored hashed and can be revoked from Settings. If you believe a secret was exposed, rotate it and tell the maintainer.
