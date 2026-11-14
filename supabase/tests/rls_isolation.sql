-- Real PostgreSQL RLS exercise for an EMPTY / DISPOSABLE hosted Supabase project.
-- Execute as the project administrator in SQL Editor AFTER the migration.
-- Creates synthetic rows in a transaction and ROLLS ALL OF THEM BACK.
-- Not executed by the generator: needs a hosted Supabase database.
BEGIN;

INSERT INTO public.universities(id,name,issuer_wallet,approved,is_demo) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DIDCHAIN TEST SCHOOL A','0x1111111111111111111111111111111111111111',true,true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','DIDCHAIN TEST SCHOOL B','0x2222222222222222222222222222222222222222',true,true);

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) VALUES
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-issuer@didchain.invalid','',now(),now()),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-student-a@didchain.invalid','',now(),now()),
 ('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-student-b@didchain.invalid','',now(),now());

UPDATE public.profiles SET role='university', university_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.profiles SET university_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wallet_address='0x3333333333333333333333333333333333333333'
WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.profiles SET university_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',wallet_address='0x4444444444444444444444444444444444444444'
WHERE id='33333333-3333-4333-8333-333333333333';

INSERT INTO public.student_records(id,university_id,student_reference,student_name,claimed_by,claim_code_hash,claim_code_expiry) VALUES
 ('11111111-aaaa-4aaa-8aaa-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TEST-A','Student A','22222222-2222-4222-8222-222222222222',repeat('a',64),now()+interval '1 day'),
 ('22222222-bbbb-4bbb-8bbb-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TEST-B','Student B','33333333-3333-4333-8333-333333333333',repeat('b',64),now()+interval '1 day');

INSERT INTO public.credentials(cert_id,university_id,student_record_id,issuer_wallet,holder_wallet,signed_credential_data,issuer_signature,pdf_sha256,credential_digest,issue_date,pdf_storage_path,encrypted_package_path,is_demo) VALUES
 ('0x'||repeat('1',64),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-aaaa-4aaa-8aaa-111111111111','0x1111111111111111111111111111111111111111','0x3333333333333333333333333333333333333333','{}','RLS_TEST_ONLY_NOT_REAL_SIGNATURE','0x'||repeat('a',64),'0x'||repeat('c',64),now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test-a.pdf','22222222-2222-4222-8222-222222222222/test-a.json',true),
 ('0x'||repeat('2',64),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-bbbb-4bbb-8bbb-222222222222','0x2222222222222222222222222222222222222222','0x4444444444444444444444444444444444444444','{}','RLS_TEST_ONLY_NOT_REAL_SIGNATURE','0x'||repeat('b',64),'0x'||repeat('d',64),now(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/test-b.pdf','33333333-3333-4333-8333-333333333333/test-b.json',true);

-- Student A is authenticated and must not see Student B's credential.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.credentials) <> 1 THEN RAISE EXCEPTION 'RLS FAIL: Student A sees wrong credential count'; END IF;
 IF EXISTS(SELECT 1 FROM public.credentials WHERE university_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') THEN RAISE EXCEPTION 'RLS FAIL: cross-student credential disclosure'; END IF;
 RAISE NOTICE 'PASS Student A sees own credential only';
END $$;

-- Permission must be DENIED. An authenticated student cannot update their role.
DO $$ BEGIN
 BEGIN
  UPDATE public.profiles SET role='university' WHERE id='22222222-2222-4222-8222-222222222222';
  RAISE EXCEPTION 'RLS FAIL: student role escalation unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS student role escalation denied by grants';
 END;
END $$;

-- The university issuer A cannot read unrelated institution B's credential/record.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.credentials) <> 1 THEN RAISE EXCEPTION 'RLS FAIL: issuer credential access not scoped'; END IF;
 IF (SELECT count(*) FROM public.student_records) <> 1 THEN RAISE EXCEPTION 'RLS FAIL: issuer student access not scoped'; END IF;
 RAISE NOTICE 'PASS university account sees only own institution';
END $$;

-- Anonymous clients lack SELECT grants entirely. A direct query must be denied.
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM count(*) FROM public.credentials;
  RAISE EXCEPTION 'RLS FAIL: anonymous credential enumeration succeeded';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS anonymous credential enumeration denied';
 END;
END $$;
RESET ROLE;

-- Atomic one-time challenge consumption, including replay rejection.
INSERT INTO public.ownership_challenges(id,cert_id,nonce,expires_at,expected_holder_wallet,request_context)
VALUES ('44444444-4444-4444-8444-444444444444','0x'||repeat('1',64),'nonce-for-test',now()+interval '2 minutes','0x3333333333333333333333333333333333333333','Test employer');
DO $$ BEGIN
 IF NOT public.consume_ownership_challenge('44444444-4444-4444-8444-444444444444','0x'||repeat('1',64),'nonce-for-test') THEN
  RAISE EXCEPTION 'FAIL challenge first use';
 END IF;
 IF public.consume_ownership_challenge('44444444-4444-4444-8444-444444444444','0x'||repeat('1',64),'nonce-for-test') THEN
  RAISE EXCEPTION 'FAIL replay was accepted';
 END IF;
 RAISE NOTICE 'PASS ownership challenge replay refused';
END $$;

ROLLBACK;
-- Expected notices: Student A isolated; role escalation denied; issuer scoped; public enumeration denied; replay refused.
