-- CloudE5 migration 0006: organisation-wide two-factor requirement.
--
-- tenants.require_mfa   When set, members without two-factor can only enrol; every other request is
--                       refused by the session check (lib/db/rls.ts assertSessionMatchesDatabase).

ALTER TABLE tenants ADD COLUMN require_mfa BOOLEAN NOT NULL DEFAULT 0;
