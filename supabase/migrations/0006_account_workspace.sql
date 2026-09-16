-- Account Workspace: extends the broker-workspace schema from 0003 for the redesigned core
-- workflow (entity-aware Insured/Contacts/Drivers/Vehicles/MVR model). Purely additive — no
-- existing column is dropped or renamed, no existing row is touched, so every submission already
-- synced to a live project keeps working unchanged; new columns are simply null/empty until a
-- broker re-saves.
--
-- Two kinds of change:
--   1. New product fields this pass adds (registeredOwner/registrationAddress on vehicles, MVR
--      data + identity-review flag + email/phone on drivers, a new `contacts` table, two new
--      CoverageType values).
--   2. A pre-existing parity gap between this schema and the client-side DriverEntry/VehicleEntry
--      types (license_number/license_class/issue_date/expiration_date/restrictions/endorsements/
--      address/is_cdl on drivers; plate on vehicles were already in the client model but never
--      had a cloud column) — closed here since this pass touches these two tables anyway. Any
--      cloud-synced submission that predates this migration simply has nulls for these columns
--      until the broker's next edit re-syncs the full row (see submissionsRepo.ts's
--      "full snapshot mirror" comment) — never a destructive change to what's already there.

-- ============================================================================================
-- drivers — parity fix + new columns
-- ============================================================================================

alter table drivers
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists license_number text,
  add column if not exists license_class text,
  add column if not exists is_cdl boolean,
  add column if not exists issue_date text,
  add column if not exists expiration_date text,
  add column if not exists restrictions text,
  add column if not exists endorsements text,
  -- One MVR report per driver, stored as JSON (reportDate/historyPeriod/violations[]/medicalCertStatus/
  -- medicalCertExpirationDate/source/lastUpdatedAt) rather than a normalized child table — this
  -- prototype only ever needs one current MVR per driver, mirroring how field_alternates already
  -- treats history as a small nested structure rather than spinning up another table+RLS surface
  -- for a single JSON blob's worth of data.
  add column if not exists mvr jsonb,
  add column if not exists identity_review_note text;

-- ============================================================================================
-- vehicles — parity fix + new columns
-- ============================================================================================

alter table vehicles
  add column if not exists plate text,
  add column if not exists registered_owner text,
  add column if not exists registration_address text;

-- ============================================================================================
-- contacts — new itemized table, same shape/RLS pattern as vehicles/drivers/losses in 0003
-- ============================================================================================

create table if not exists contacts (
  id text primary key,
  submission_id text not null references submissions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  role text,
  phone text,
  email text,
  is_manual boolean not null default false,
  source_document_id text,
  source_page int,
  source_excerpt text,
  last_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contacts_submission_id_idx on contacts (submission_id);
create index if not exists contacts_user_id_idx on contacts (user_id);

alter table contacts enable row level security;

create policy "owner can select own contacts" on contacts for select to authenticated using (user_id = auth.uid());
create policy "owner can insert own contacts" on contacts for insert to authenticated with check (user_id = auth.uid());
create policy "owner can update own contacts" on contacts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner can delete own contacts" on contacts for delete to authenticated using (user_id = auth.uid());

-- ============================================================================================
-- coverage_lines — widen the coverage_type check constraint for the two new CoverageType values
-- ============================================================================================

alter table coverage_lines drop constraint if exists coverage_lines_type_check;
alter table coverage_lines add constraint coverage_lines_type_check
  check (coverage_type in (
    'auto_liability', 'motor_truck_cargo', 'physical_damage', 'general_liability',
    'warehouse_legal_liability', 'trailer_interchange', 'non_trucking_liability'
  ));

-- ============================================================================================
-- intake_links — brokerage identity, so an applicant can tell who is actually asking for and
-- receiving their submission (see types/intake.ts's comment and IntakeFormPage.tsx). Nullable and
-- additive — an existing link simply has none until the broker edits it.
-- ============================================================================================

alter table intake_links add column if not exists brokerage_name text;

-- ============================================================================================
-- documents — widen the category default/values are unconstrained text already (no check
-- constraint exists on `documents.category` in 0003), so the new 'mvr' DocumentCategory needs no
-- migration here; noted for completeness only.
-- ============================================================================================

-- ============================================================================================
-- field_values — widen the extraction_method check constraint to include the two methods added
-- since 0003 was written (image_ocr was already present; vision_extraction and applicant_provided
-- were added later but the constraint was never updated, so a synced field using either would have
-- been silently rejected by the DB in a live project). Purely a correctness fix, not new scope.
-- ============================================================================================

alter table field_values drop constraint if exists field_values_extraction_method_check;
alter table field_values add constraint field_values_extraction_method_check
  check (extraction_method is null or extraction_method in (
    'ai_extraction', 'deterministic_import', 'manual_entry', 'image_ocr', 'vision_extraction', 'applicant_provided'
  ));

alter table field_alternates drop constraint if exists field_alternates_extraction_method_check;
alter table field_alternates add constraint field_alternates_extraction_method_check
  check (extraction_method is null or extraction_method in (
    'ai_extraction', 'deterministic_import', 'manual_entry', 'image_ocr', 'vision_extraction', 'applicant_provided'
  ));
