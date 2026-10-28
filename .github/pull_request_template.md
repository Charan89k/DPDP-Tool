## Summary

<!-- What changes and why, in a few bullet points. -->

## Checks

- [ ] `npm run lint` and `npx tsc --noEmit` are clean
- [ ] `npm test` passes; new logic has a test
- [ ] Browser tests run if a user flow changed (`E2E_BASE_URL=... npm run test:e2e`)
- [ ] New migration added instead of editing an applied one (if the schema changed)
- [ ] No secrets, `.env` values or personal data in the diff
- [ ] Docs updated (README / `docs/`) if behaviour or deployment changed
