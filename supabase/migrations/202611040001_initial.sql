-- DID-Chain 1.0: apply once via `supabase db push` or SQL Editor.
-- Auth roles are NEVER derived from user-editable sign-up metadata.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  issuer_wallet text not null check (issuer_wallet ~ '^0x[0-9a-fA-F]{40}$'),
  approved boolean not null default false,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Student',
  role text not null default 'student' check (role in ('student','university')),
  university_id uuid references public.universities(id),
  wallet_address text check (wallet_address is null or wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  wallet_binding_signature text,
  wallet_binding_challenge text,
  encryption_public_key jsonb,
  encryption_key_binding_signature text,
  encryption_key_binding_challenge text,
  created_at timestamptz not null default now()
);
create table if not exists public.student_records (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id),
  student_reference text not null,
  student_name text not null,
  claimed_by uuid unique references public.profiles(id),
  claim_code_hash text not null check (claim_code_hash ~ '^[0-9a-f]{64}$'),
  claim_code_expiry timestamptz not null,
  created_at timestamptz not null default now(),
  unique (university_id, student_reference)
);
create table if not exists public.credentials (
  cert_id text primary key check (cert_id ~ '^0x[0-9a-fA-F]{64}$'),
  university_id uuid not null references public.universities(id),
  student_record_id uuid not null references public.student_records(id),
  issuer_wallet text not null,
  holder_wallet text not null,
  signed_credential_data jsonb not null,
  issuer_signature text not null,
  pdf_sha256 text not null unique check (pdf_sha256 ~ '^0x[0-9a-fA-F]{64}$'),
  credential_digest text not null unique check (credential_digest ~ '^0x[0-9a-fA-F]{64}$'),
  issue_date timestamptz not null,
  expiry_date timestamptz,
  issuance_state text not null default 'pending' check (issuance_state in ('pending','registered','delivery_failed','delivered','revoked')),
  transaction_hash text,
  block_number bigint,
  revocation_transaction_hash text,
  pdf_storage_path text not null,
  encrypted_package_path text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nonce text not null,
  purpose text not null check (purpose in ('wallet','encryption')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.ownership_challenges (
  id uuid primary key default gen_random_uuid(),
  cert_id text not null references public.credentials(cert_id),
  nonce text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  expected_holder_wallet text not null,
  request_context text not null,
  created_at timestamptz not null default now()
);
create index if not exists ix_records_university on public.student_records(university_id);
create index if not exists ix_credentials_university on public.credentials(university_id);
create index if not exists ix_credentials_student on public.credentials(student_record_id);
create index if not exists ix_auth_challenges_user on public.auth_challenges(user_id, expires_at);

-- A new sign-up only ever receives student permissions.
create or replace function public.create_student_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name','Student'),120), 'student');
  return new;
end $$;
drop trigger if exists on_auth_user_created_didchain on auth.users;
create trigger on_auth_user_created_didchain after insert on auth.users
for each row execute function public.create_student_profile();

-- RLS helper accessible only to signed-in users; no user-editable authorization state.
create or replace function public.my_university_id() returns uuid
language sql stable security definer set search_path = '' as $$
 select p.university_id from public.profiles p
 join public.universities u on u.id=p.university_id
 where p.id=(select auth.uid()) and p.role='university' and u.approved=true
$$;
revoke all on function public.my_university_id() from public, anon;
grant execute on function public.my_university_id() to authenticated;

-- Atomic one-time record claim with SHA-256(code) comparison.
create or replace function public.claim_student_record(p_record uuid, p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_university uuid;
begin
 if (select auth.uid()) is null or length(p_code) < 24 then return false; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and role='student' and university_id is null) then return false; end if;
 update public.student_records set claimed_by=auth.uid(), claim_code_hash=repeat('0',64)
 where id=p_record and claimed_by is null and claim_code_expiry > now()
 and claim_code_hash=encode(extensions.digest(p_code,'sha256'),'hex')
 returning university_id into v_university;
 if v_university is null then return false; end if;
 update public.profiles set university_id=v_university where id=auth.uid() and role='student' and university_id is null;
 if not found then raise exception 'Student profile changed during claim'; end if;
 return true;
end $$;
revoke all on function public.claim_student_record(uuid,text) from public, anon;
grant execute on function public.claim_student_record(uuid,text) to authenticated;

-- Trusted Edge Function uses service_role to atomically consume short-lived authentication nonces.
create or replace function public.consume_auth_challenge(p_id uuid, p_user uuid, p_purpose text, p_nonce text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
 update public.auth_challenges set used_at=now()
 where id=p_id and user_id=p_user and purpose=p_purpose and nonce=p_nonce
 and used_at is null and expires_at > now();
 get diagnostics n=row_count;
 return n=1;
end $$;
revoke all on function public.consume_auth_challenge(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.consume_auth_challenge(uuid,uuid,text,text) to service_role;

create or replace function public.consume_ownership_challenge(p_id uuid, p_cert text, p_nonce text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
 update public.ownership_challenges set used_at=now()
 where id=p_id and cert_id=p_cert and nonce=p_nonce
 and used_at is null and expires_at > now();
 get diagnostics n=row_count;
 return n=1;
end $$;
revoke all on function public.consume_ownership_challenge(uuid,text,text) from public, anon, authenticated;
grant execute on function public.consume_ownership_challenge(uuid,text,text) to service_role;

-- Lock signed evidence after insertion. The chain is source of truth; this trigger prevents accidental edits.
create or replace function public.credential_immutability() returns trigger
language plpgsql set search_path = '' as $$
begin
 if (new.cert_id, new.university_id, new.student_record_id, new.issuer_wallet, new.holder_wallet,
     new.signed_credential_data, new.issuer_signature, new.pdf_sha256, new.credential_digest,
     new.issue_date, new.expiry_date, new.pdf_storage_path, new.is_demo)
 is distinct from
    (old.cert_id, old.university_id, old.student_record_id, old.issuer_wallet, old.holder_wallet,
     old.signed_credential_data, old.issuer_signature, old.pdf_sha256, old.credential_digest,
     old.issue_date, old.expiry_date, old.pdf_storage_path, old.is_demo) then
   raise exception 'Signed credential evidence is immutable';
 end if;
 if new.issuance_state <> old.issuance_state and not (
  (old.issuance_state='pending' and new.issuance_state='registered') or
  (old.issuance_state='registered' and new.issuance_state in ('delivered','delivery_failed','revoked')) or
  (old.issuance_state='delivery_failed' and new.issuance_state in ('delivered','revoked')) or
  (old.issuance_state='delivered' and new.issuance_state='revoked')
 ) then raise exception 'Invalid issuance state transition'; end if;
 return new;
end $$;
drop trigger if exists immutable_credential_evidence on public.credentials;
create trigger immutable_credential_evidence before update on public.credentials for each row
execute function public.credential_immutability();

alter table public.universities enable row level security;
alter table public.profiles enable row level security;
alter table public.student_records enable row level security;
alter table public.credentials enable row level security;
alter table public.auth_challenges enable row level security;
alter table public.ownership_challenges enable row level security;

revoke all on public.universities, public.profiles, public.student_records, public.credentials,
 public.auth_challenges, public.ownership_challenges from anon, authenticated;
grant select on public.universities, public.profiles, public.student_records, public.credentials to authenticated;
grant insert on public.student_records to authenticated;
grant insert on public.credentials to authenticated;
grant update(issuance_state, transaction_hash, block_number, revocation_transaction_hash, encrypted_package_path)
 on public.credentials to authenticated;

create policy universities_member_read on public.universities for select to authenticated
using (id=(select university_id from public.profiles where id=(select auth.uid())));
create policy profile_self_read on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profile_issuer_student_read on public.profiles for select to authenticated using (
 role='student' and university_id=(select public.my_university_id()) and
 exists(select 1 from public.student_records sr where sr.claimed_by=profiles.id and sr.university_id=(select public.my_university_id()))
);
create policy records_issuer_read on public.student_records for select to authenticated
using (university_id=(select public.my_university_id()));
create policy records_student_read on public.student_records for select to authenticated
using (claimed_by=(select auth.uid()));
create policy records_issuer_insert on public.student_records for insert to authenticated
with check (university_id=(select public.my_university_id()) and claimed_by is null);
create policy credential_issuer_read on public.credentials for select to authenticated
using (university_id=(select public.my_university_id()));
create policy credential_student_read on public.credentials for select to authenticated
using (exists(select 1 from public.student_records sr where sr.id=student_record_id and sr.claimed_by=(select auth.uid())));
create policy credential_issuer_insert on public.credentials for insert to authenticated with check (
 university_id=(select public.my_university_id()) and issuance_state='pending' and
 exists(select 1 from public.student_records sr
 join public.profiles student on student.id=sr.claimed_by
 join public.universities uni on uni.id=sr.university_id
 where sr.id=student_record_id and sr.university_id=credentials.university_id
 and student.wallet_address=credentials.holder_wallet and uni.issuer_wallet=credentials.issuer_wallet)
);
create policy credential_issuer_update on public.credentials for update to authenticated
using (university_id=(select public.my_university_id()))
with check (university_id=(select public.my_university_id()));

-- Bucket paths: PDFs university_uuid/certid.pdf; encrypted packages student_user_uuid/certid.json.
insert into storage.buckets(id,name,public,file_size_limit)
values ('didchain-pdfs','didchain-pdfs',false,8388608),('didchain-packages','didchain-packages',false,12582912)
on conflict (id) do nothing;
create policy didchain_pdf_issuer_read on storage.objects for select to authenticated using (
 bucket_id='didchain-pdfs' and (storage.foldername(name))[1]=(select public.my_university_id())::text
);
create policy didchain_pdf_issuer_write on storage.objects for insert to authenticated with check (
 bucket_id='didchain-pdfs' and (storage.foldername(name))[1]=(select public.my_university_id())::text and
 exists(select 1 from public.credentials c where c.pdf_storage_path=name and c.university_id=(select public.my_university_id()))
);
create policy didchain_package_owner_read on storage.objects for select to authenticated using (
 bucket_id='didchain-packages' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy didchain_package_issuer_write on storage.objects for insert to authenticated with check (
 bucket_id='didchain-packages' and exists(select 1 from public.credentials c
 join public.student_records sr on sr.id=c.student_record_id
 where c.encrypted_package_path=name and sr.claimed_by::text=(storage.foldername(name))[1]
 and c.university_id=(select public.my_university_id()))
);

-- Privileged admin bootstrap is deliberately MANUAL in SQL Editor (see MANUAL_SETUP.md).
-- There are no policies granting a user the ability to edit role/university approval.
