-- CloudE5 migration 0008: organisation contact details captured during onboarding.
--
-- tenants.industry already holds the organisation type (a listed type or the customer's own text).
-- tenants.team_size       Size band chosen from a list (e.g. "51-200").
-- tenants.contact_phone   Main company phone number.
-- tenants.contact_email   Main company email address (work domain).
-- tenants.website         Company website.
-- tenants.address         Registered or main office address.

ALTER TABLE tenants ADD COLUMN team_size TEXT;
ALTER TABLE tenants ADD COLUMN contact_phone TEXT;
ALTER TABLE tenants ADD COLUMN contact_email TEXT;
ALTER TABLE tenants ADD COLUMN website TEXT;
ALTER TABLE tenants ADD COLUMN address TEXT;
