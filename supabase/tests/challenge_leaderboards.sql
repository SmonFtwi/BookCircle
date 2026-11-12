begin;
-- Deterministic, rollback-only fixtures for ranking, privacy, and club isolation.
do $$
declare
 c uuid; other_club uuid; book uuid; foreign_book uuid; ch uuid; empty_ch uuid;
 u uuid; i int; metric text; expected int; j jsonb; leaders jsonb; rejected boolean;
 code text=upper('LEADERS-'||gen_random_uuid());
 first_id uuid='aa000000-0000-0000-0000-000000000001';
 second_id uuid='aa000000-0000-0000-0000-000000000002';
begin
 insert into public.clubs(name) values('Leaderboard test') returning id into c;
 insert into public.clubs(name) values('Other leaderboard club') returning id into other_club;
 insert into public.club_revisions(club_id) values(c),(other_club);
 insert into public.invitations(club_id,code_hash,expires_at,max_uses)
 values(c,encode(extensions.digest(code,'sha256'),'hex'),now()+interval '1 hour',6),
 (other_club,encode(extensions.digest(code||'OTHER','sha256'),'hex'),now()+interval '1 hour',1);
 for i in 1..7 loop
   u=('aa000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
   insert into auth.users(id,email,raw_user_meta_data) values(u,'leader'||i||'@example.invalid',
     jsonb_build_object('name','Reader '||i,'invite_code',case when i=7 then code||'OTHER' else code end,'timezone','Asia/Dubai'));
 end loop;
 update public.memberships set status='inactive' where profile_id='aa000000-0000-0000-0000-000000000006';
 insert into public.books(club_id,title,author,total_pages) values(c,'Test','Test',1000) returning id into book;
 insert into public.books(club_id,title,author,total_pages) values(other_club,'Foreign','Test',1000) returning id into foreign_book;
 -- Readers 1 and 2 tie, 3 and 4 tie for third; 5 has no activity; 6 is inactive; 7 belongs elsewhere.
 for i in 1..7 loop
   if i=5 then continue; end if;
   u=('aa000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
   insert into public.reading_logs(profile_id,club_id,book_id,date,end_page,pages,minutes,notes)
     values(u,c,book,'2020-01-01',10,10,30,'SECRET NOTE');
   insert into public.insights(club_id,author_id,title,content,created_at)
     values(c,u,'Test','PRIVATE CONTENT','2019-12-31 20:00:00+00'); -- Jan 1 in Dubai
   insert into public.commitments(club_id,profile_id,title,target_date,status,completed_at)
     values(c,u,'PRIVATE COMMITMENT','2020-01-01','completed','2019-12-31 20:00:00+00');
   if i in (1,2,6,7) then
     insert into public.reading_logs(profile_id,club_id,book_id,date,end_page,pages,minutes)
       values(u,c,book,'2020-01-02',10,10,30);
     insert into public.insights(club_id,author_id,title,content,created_at)
       values(c,u,'Test','PRIVATE CONTENT','2020-01-02 19:59:59+00');
     insert into public.commitments(club_id,profile_id,title,target_date,status,completed_at)
       values(c,u,'PRIVATE COMMITMENT','2020-01-02','completed','2020-01-02 19:59:59+00');
   end if;
 end loop;
 -- Duplicate sessions count minutes, but not another reading day.
 insert into public.reading_logs(profile_id,club_id,book_id,date,end_page,pages,minutes)
 values(first_id,c,book,'2020-01-01',1,1,1),(second_id,c,book,'2020-01-01',1,1,1),
 (first_id,c,book,'2019-12-31',1,1,999),(first_id,c,book,'2020-01-03',1,1,999),
 (first_id,other_club,foreign_book,'2020-01-01',1,1,999);
 insert into public.insights(club_id,author_id,title,content,created_at) values
 (c,first_id,'Outside','SECRET','2019-12-31 19:59:59+00'),(c,first_id,'Outside','SECRET','2020-01-02 20:00:00+00'),
 (other_club,first_id,'Foreign','SECRET','2020-01-01 00:00:00+00');
 insert into public.commitments(club_id,profile_id,title,target_date,status,completed_at) values
 (c,first_id,'Outside','2020-01-01','completed','2019-12-31 19:59:59+00'),
 (c,first_id,'Outside','2020-01-03','completed','2020-01-02 20:00:00+00'),
 (other_club,first_id,'Foreign','2020-01-01','completed','2020-01-01 00:00:00+00'),
 (c,first_id,'Pending','2020-01-01','pending',null);
 foreach metric in array array['minutes','days','insights','commitments'] loop
   insert into public.challenges(club_id,title,start_date,end_date,goal_type,target,created_by)
     values(c,metric,'2020-01-01','2020-01-02',metric,1,first_id) returning id into ch;
   insert into public.challenge_participants(challenge_id,profile_id)
     select ch,id from public.profiles where id::text like 'aa000000-0000-0000-0000-%';
   perform set_config('request.jwt.claim.sub',first_id::text,true);
   perform set_config('role','authenticated',true);
   select value into j from jsonb_array_elements(public.bookcircle_query('club.challenges')) where value->'challenge'->>'_id'=ch::text;
   if j::text like '%aa000000-0000-0000-0000-000000000007%' or j::text like '%aa000000-0000-0000-0000-000000000006%' then raise exception 'Ineligible participant exposed'; end if;
   leaders=j->'leaderboard'; expected=case when metric='minutes' then 61 else 2 end;
   if jsonb_array_length(leaders)<>3 then raise exception '%: expected top three: %',metric,leaders; end if;
   if leaders->0->>'profileId'<>first_id::text or leaders->1->>'profileId'<>second_id::text
     or leaders->2->>'profileId'<>'aa000000-0000-0000-0000-000000000003'
     or (leaders->0->>'rank')::int<>1 or (leaders->1->>'rank')::int<>1 or (leaders->2->>'rank')::int<>3
     then raise exception '%: unstable ties or ineligible leaders: %',metric,leaders; end if;
   if (leaders->0->>'progress')::int<>expected or (j->>'progress')::int<>expected or not (j->>'completed')::boolean
     then raise exception '%: incorrect progress or date/club leakage: %',metric,j; end if;
   if (select count(*) from jsonb_object_keys(leaders->0))<>4 or leaders::text ~ 'SECRET|PRIVATE|email|notes|content'
     then raise exception 'Leaderboard exposes private details'; end if;
   perform set_config('role','none',true);
   -- Fewer than three participants; zero activity excluded even when joined.
   delete from public.challenge_participants where challenge_id=ch and profile_id not in(first_id,'aa000000-0000-0000-0000-000000000005');
   if jsonb_array_length(private.challenge_leaderboard((select x from public.challenges x where id=ch)))<>1 then raise exception 'Small leaderboard incorrect'; end if;
 end loop;
 insert into public.challenges(club_id,title,start_date,end_date,goal_type,target,created_by)
 values(c,'Empty','2020-01-01','2020-01-02','minutes',30,first_id) returning id into empty_ch;
 if private.challenge_leaderboard((select x from public.challenges x where id=empty_ch))<>'[]'::jsonb then raise exception 'Empty leaderboard incorrect'; end if;
 insert into public.challenge_participants(challenge_id,profile_id) values(empty_ch,'aa000000-0000-0000-0000-000000000005');
 if private.challenge_leaderboard((select x from public.challenges x where id=empty_ch))<>'[]'::jsonb then raise exception 'Zero progress must not rank'; end if;
 perform set_config('request.jwt.claim.sub','aa000000-0000-0000-0000-000000000007',true);
 perform set_config('role','authenticated',true);
 if public.bookcircle_query('club.challenges')<>'[]'::jsonb then raise exception 'Foreign club can read challenges'; end if;
 rejected=false; begin perform public.bookcircle_mutate('club.joinChallenge',jsonb_build_object('id',empty_ch)); exception when others then rejected=true; end;
 if not rejected then raise exception 'Foreign member joined challenge'; end if;
 perform set_config('request.jwt.claim.sub','aa000000-0000-0000-0000-000000000006',true);
 rejected=false; begin perform public.bookcircle_query('club.challenges'); exception when insufficient_privilege then rejected=true; end;
 if not rejected then raise exception 'Inactive member can read leaderboard'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 rejected=false; begin perform public.bookcircle_query('club.challenges'); exception when insufficient_privilege then rejected=true; end;
 if not rejected then raise exception 'Missing identity can read leaderboard'; end if;
 if has_function_privilege('authenticated','private.challenge_leaderboard(public.challenges)','EXECUTE') then raise exception 'Private leaderboard helper is directly callable'; end if;
 perform set_config('role','anon',true);
 rejected=false; begin perform public.bookcircle_query('club.challenges'); exception when insufficient_privilege then rejected=true; end;
 if not rejected then raise exception 'Anonymous access allowed'; end if;
 perform set_config('role','none',true);
end $$;
rollback;
select 'Challenge leaderboard ranking and isolation checks passed' as result;
