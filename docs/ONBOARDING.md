# Onboarding customers

A customer organisation joins CloudE5 in one of two ways: it signs itself up, or a platform
administrator creates it. Both need working email (verification, password reset and invitation links),
so configure SMTP first ([SELF_HOSTING.md](SELF_HOSTING.md#configuration-reference)). With the `mail`
profile, emails are caught by Mailpit at `http://localhost:8025` instead of being delivered.

## Option A: self-service sign-up

1. Send the customer your CloudE5 address.
2. They choose **Create account** and enter their name, work email, organisation name and password.
3. They open the verification link from the email and sign in.
4. A setup wizard records the organisation profile and starts the first assessment.
5. The person who registered becomes the organisation's administrator and invites colleagues from
   **Team**.

## Option B: created by a platform administrator

1. Sign in as the platform administrator (created with `admin:create`).
2. Go to **Dashboard → Customers → New customer** and fill in the organisation details.
3. To create the customer's first administrator now, tick **Provision User Account Immediately** and
   enter their name and email.
   - Leave the password blank (recommended). The user receives a verification email, then chooses their
     own password with **Forgot password** on the sign-in page.
   - If you set a password, it must meet the password rules and you must share it securely.
4. To add more people later, open the customer and use **Add / Invite User**. Each invitee receives a
   single-use activation link.

## Roles

| Role | Scope | Typical use |
|---|---|---|
| Platform administrator (`TLI_SUPER_ADMIN`) | all organisations | creates customers, manages users, finalises assessments |
| Lead consultant (`TLI_LEAD_CONSULTANT`) | assigned organisations | runs and finalises assisted assessments |
| Reviewer (`TLI_REVIEWER`) | assigned organisations | reviews answers and evidence |
| Client administrator (`CLIENT_ADMIN`) | own organisation | manages its users, starts assessments |
| BU lead, contributor (`CLIENT_BU_LEAD`, `CLIENT_CONTRIBUTOR`) | own organisation | answer questions, upload evidence |
| Viewer (`CLIENT_VIEWER`) | own organisation | read only |

The full permission matrix is in [02_roles_and_permissions_matrix.md](reference/02_roles_and_permissions_matrix.md).

## Two-factor sign-in

Every user can turn on two-factor sign-in under **Settings**. A client administrator (or the platform
administrator) can require it for the whole organisation from the same page; users without it are then
sent to set it up before they can use the dashboard. Turn it on for the platform administrator account
first, since that account can see every organisation.

## Support tasks

Confirm the person's identity out of band before using either override.

```bash
docker compose run --rm cloude5 verify-email user@example.com --confirm  # email cannot be delivered
docker compose run --rm cloude5 reset-mfa user@example.com --confirm     # lost authenticator and recovery codes
```

See [SELF_HOSTING.md](SELF_HOSTING.md#operations-reference) for the complete list.
