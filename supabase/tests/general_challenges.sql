begin;
-- All fixtures and helper functions roll back. Exercise the public RPCs as authenticated members.
create function pg_temp.expect_challenge_error(op text, args jsonb, is_query boolean default false) returns void language plpgsql as $$
declare rejected boolean=false;
begin
 begin
 if is_query then perform public.bookcircle_query(op,args); else perform public.bookcircle_mutate(op,args); end if;
 exception when others then rejected=true;
 end;
 if not rejected then raise exception 'Expected rejection for %: %',op,args; end if;
end $$;

do $$
declare
 c uuid; foreign_club uuid; ch uuid; total_ch uuid; check_ch uuid; minimum_ch uuid; upcoming_ch uuid; muted_ch uuid; auto_ch uuid;
 admin_id uuid=gen_random_uuid(); moderator_id uuid=gen_random_uuid(); member_id uuid=gen_random_uuid(); other_id uuid=gen_random_uuid(); stranger_id uuid=gen_random_uuid();
 code text=upper('GENERAL-'||gen_random_uuid()); d date=(now() at time zone 'Pacific/Kiritimati')::date;
 j jsonb; args jsonb; initial_revision bigint;
begin
 insert into public.clubs(name) values('General challenge fixtures') returning id into c;
 insert into public.clubs(name) values('Foreign fixtures') returning id into foreign_club;
 insert into public.club_revisions(club_id) values(c),(foreign_club);
 insert into public.invitations(club_id,code_hash,expires_at,max_uses) values
 (c,encode(extensions.digest(code,'sha256'),'hex'),now()+interval '1 hour',4),
 (foreign_club,encode(extensions.digest(code||'FOREIGN','sha256'),'hex'),now()+interval '1 hour',1);
 insert into auth.users(id,email,raw_user_meta_data) values
 (admin_id,admin_id||'@example.invalid',jsonb_build_object('name','Admin','invite_code',code,'timezone','Pacific/Kiritimati')),
 (moderator_id,moderator_id||'@example.invalid',jsonb_build_object('name','Moderator','invite_code',code,'timezone','Pacific/Kiritimati')),
 (member_id,member_id||'@example.invalid',jsonb_build_object('name','Member','invite_code',code,'timezone','Pacific/Kiritimati')),
 (other_id,other_id||'@example.invalid',jsonb_build_object('name','Other','invite_code',code,'timezone','Pacific/Kiritimati')),
 (stranger_id,stranger_id||'@example.invalid',jsonb_build_object('name','Stranger','invite_code',code||'FOREIGN','timezone','Pacific/Kiritimati'));
 update public.memberships set role='admin' where profile_id=admin_id;
 update public.memberships set role='moderator' where profile_id=moderator_id;
 select revision into initial_revision from public.club_revisions where club_id=c;
 perform set_config('request.jwt.claim.sub',moderator_id::text,true);
 perform set_config('role','authenticated',true);
 j=public.bookcircle_query('club.challengeMembers');
 if jsonb_array_length(j)<>4 or j::text like '%email%' then raise exception 'Member picker leaks or omits members'; end if;
 perform pg_temp.expect_challenge_error('admin.members','{}',true);
 args=jsonb_build_object('title','Private screen goal','description','Private challenge','category','screen_time','participationMode','invite_only','goalType','daily_number','unit','minutes','comparison','maximum','dailyThreshold',120,'target',3,'startDate',d-2,'endDate',d+5,'memberIds',jsonb_build_array(member_id,other_id));
 ch=(public.bookcircle_mutate('club.saveChallenge',args)#>>'{}')::uuid;
 -- Duplicate invitations are idempotent; cross-club candidates are rejected.
 perform public.bookcircle_mutate('club.inviteChallengeMembers',jsonb_build_object('id',ch,'memberIds',jsonb_build_array(member_id,member_id)));
 perform pg_temp.expect_challenge_error('club.inviteChallengeMembers',jsonb_build_object('id',ch,'memberIds',jsonb_build_array(stranger_id)));
 perform set_config('role','none',true);
 if (select count(*) from public.notifications where dedupe_key like 'challenge-invite:'||ch||':%')<>2 then raise exception 'Duplicate or missing notifications'; end if;
 if exists(select 1 from public.notifications where body='Private screen goal' and profile_id not in(member_id,other_id)) then raise exception 'Private challenge was broadcast'; end if;
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform set_config('role','authenticated',true);
 j=public.bookcircle_query('club.challenges')->0;
 if j->>'participationStatus'<>'invited' or (j->>'joined')::boolean or j->'participants'<>'[]'::jsonb or j->'invitations'<>'[]'::jsonb then raise exception 'Pending participation exposed incorrectly'; end if;
 perform pg_temp.expect_challenge_error('club.joinChallenge',jsonb_build_object('id',ch));
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d,'value',0));
 perform pg_temp.expect_challenge_error('club.challengeEntries',jsonb_build_object('id',ch),true);
 perform pg_temp.expect_challenge_error('club.challengeMembers','{}',true);
 perform pg_temp.expect_challenge_error('club.saveChallenge',args);
 perform pg_temp.expect_challenge_error('club.inviteChallengeMembers',jsonb_build_object('id',ch,'memberIds',jsonb_build_array(admin_id)));
 perform public.bookcircle_mutate('club.respondChallengeInvitation',jsonb_build_object('id',ch,'response','accepted'));
 perform public.bookcircle_mutate('club.respondChallengeInvitation',jsonb_build_object('id',ch,'response','accepted'));
 perform pg_temp.expect_challenge_error('club.respondChallengeInvitation',jsonb_build_object('id',ch,'response','declined'));
 j=public.bookcircle_query('club.challenges')->0;
 if j->>'acceptedDate'<>d::text or (j->>'progress')::numeric<>0 then raise exception 'Timezone acceptance or missing-entry scoring failed'; end if;
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d-1,'value',0));
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d+1,'value',0));
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d,'value',-1));
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d,'value',0.001));
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d,'value',0));
 j=public.bookcircle_query('club.challenges')->0;
 if (j->>'progress')::numeric<>1 or (j->'leaderboard'->0->>'progress')::numeric<>1 then raise exception 'Explicit zero should meet maximum'; end if;
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d,'value',121));
 if (public.bookcircle_query('club.challenges')->0->>'progress')::numeric<>0 then raise exception 'Entry edit did not change score'; end if;
 if jsonb_array_length(public.bookcircle_query('club.challengeEntries',jsonb_build_object('id',ch)))<>1 then raise exception 'Daily uniqueness failed'; end if;
 perform public.bookcircle_mutate('club.deleteChallengeEntry',jsonb_build_object('id',ch,'date',d));
 if public.bookcircle_query('club.challengeEntries',jsonb_build_object('id',ch))<>'[]'::jsonb then raise exception 'Entry deletion failed'; end if;
 -- Historical entries after acceptance, including the challenge start boundary.
 perform set_config('role','none',true);
 update public.challenge_participants set accepted_date=d-2 where challenge_id=ch and profile_id=member_id;
 perform set_config('role','authenticated',true);
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d-2,'value',120));
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d-1,'value',119));
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d,'value',0));
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d-3,'value',0));
 if not (public.bookcircle_query('club.challenges')->0->>'completed')::boolean then raise exception 'Daily goal completion failed'; end if;
 -- A manager cannot read a member's private entries, even with an injected profile ID.
 perform set_config('request.jwt.claim.sub',moderator_id::text,true);
 perform pg_temp.expect_challenge_error('club.challengeEntries',jsonb_build_object('id',ch,'profileId',member_id),true);
 perform pg_temp.expect_challenge_error('club.revokeChallengeInvitation',jsonb_build_object('id',ch,'profileId',member_id));
 perform public.bookcircle_mutate('club.saveChallenge',jsonb_build_object('id',ch,'title','Renamed','description','Edited','target',999,'participationMode','open'));
 if (public.bookcircle_query('club.challenges')->0->'challenge'->>'target')::numeric<>3 or public.bookcircle_query('club.challenges')->0->'challenge'->>'participationMode'<>'invite_only' then raise exception 'Goal rules changed'; end if;
 -- Decline, reinvite, revoke and reinvite without leaked notifications.
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 perform public.bookcircle_mutate('club.respondChallengeInvitation',jsonb_build_object('id',ch,'response','declined'));
 perform public.bookcircle_mutate('club.respondChallengeInvitation',jsonb_build_object('id',ch,'response','declined'));
 perform set_config('request.jwt.claim.sub',moderator_id::text,true);
 perform public.bookcircle_mutate('club.inviteChallengeMembers',jsonb_build_object('id',ch,'memberIds',jsonb_build_array(other_id)));
 perform public.bookcircle_mutate('club.revokeChallengeInvitation',jsonb_build_object('id',ch,'profileId',other_id));
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 if public.bookcircle_query('club.challenges')<>'[]'::jsonb then raise exception 'Revoked member still sees private challenge'; end if;
 if public.bookcircle_query('notifications.list')::text like '%'||ch||'%' then raise exception 'Revoked notification remains'; end if;
 perform pg_temp.expect_challenge_error('club.respondChallengeInvitation',jsonb_build_object('id',ch,'response','accepted'));
 perform set_config('request.jwt.claim.sub',moderator_id::text,true);
 perform public.bookcircle_mutate('club.inviteChallengeMembers',jsonb_build_object('id',ch,'memberIds',jsonb_build_array(other_id)));
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 perform public.bookcircle_mutate('club.respondChallengeInvitation',jsonb_build_object('id',ch,'response','accepted'));
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',ch,'date',d,'value',80));
 -- Owner scoping ignores spoofed profile IDs and returns only one's own entry.
 j=public.bookcircle_query('club.challengeEntries',jsonb_build_object('id',ch,'profileId',member_id));
 if jsonb_array_length(j)<>1 or (j->0->>'value')::numeric<>80 then raise exception 'Daily entry ownership leaked'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 -- Managers can see private challenges, but ordinary uninvited members cannot.
 perform set_config('role','none',true);
 update public.memberships set role='member' where profile_id=admin_id;
 perform set_config('role','authenticated',true);
 if public.bookcircle_query('club.challenges')<>'[]'::jsonb then raise exception 'Uninvited member sees private challenge'; end if;
 perform pg_temp.expect_challenge_error('club.challengeEntries',jsonb_build_object('id',ch),true);
 perform set_config('role','none',true);
 update public.memberships set role='admin' where profile_id=admin_id;
 perform set_config('role','authenticated',true);
 -- Opted-out invitees still receive invitations in the challenge view, but no notification.
 perform set_config('role','none',true);
 update public.profiles set notifications_enabled=false where id=other_id;
 perform set_config('role','authenticated',true);
 muted_ch=(public.bookcircle_mutate('club.saveChallenge',args||jsonb_build_object('title','Muted invite','memberIds',jsonb_build_array(other_id)))#>>'{}')::uuid;
 perform set_config('role','none',true);
 if exists(select 1 from public.notifications where dedupe_key='challenge-invite:'||muted_ch||':'||other_id) then raise exception 'Opted-out notification created'; end if;
 update public.profiles set notifications_enabled=true where id=other_id;
 -- Hourly completion must ignore pending invitees, even when automatic activity meets the target.
 insert into public.challenges(club_id,title,goal_type,target,start_date,end_date,created_by,participation_mode)
 values(c,'Automatic invited','commitments',1,d,d+2,admin_id,'invite_only') returning id into auto_ch;
 insert into public.challenge_participants(challenge_id,profile_id,status,accepted_date) values(auto_ch,member_id,'invited',null),(auto_ch,other_id,'accepted',d);
 insert into public.commitments(club_id,profile_id,title,target_date,status,completed_at) values(c,member_id,'Test',d,'completed',now()),(c,other_id,'Test',d,'completed',now());
 perform private.scheduled_work();
 if exists(select 1 from public.challenge_participants where challenge_id=auto_ch and profile_id=member_id and completed_at is not null) then raise exception 'Hourly job completed an invitation'; end if;
 if not exists(select 1 from public.challenge_participants where challenge_id=auto_ch and profile_id=other_id and completed_at is not null) then raise exception 'Hourly job omitted accepted participant'; end if;
 perform set_config('role','authenticated',true);
 -- Public numeric, check-in and daily minimum goals can coexist.
 args=jsonb_build_object('title','Movement','category','fitness','goalType','total','unit','km','target',5,'startDate',d,'endDate',d+2);
 total_ch=(public.bookcircle_mutate('club.saveChallenge',args)#>>'{}')::uuid;
 check_ch=(public.bookcircle_mutate('club.saveChallenge',args||jsonb_build_object('title','Meal plan','category','diet','goalType','daily_checkin','target',1))#>>'{}')::uuid;
 minimum_ch=(public.bookcircle_mutate('club.saveChallenge',args||jsonb_build_object('title','Steps','goalType','daily_number','unit','steps','dailyThreshold',8000,'comparison','minimum','target',2))#>>'{}')::uuid;
 upcoming_ch=(public.bookcircle_mutate('club.saveChallenge',args||jsonb_build_object('startDate',d+1,'endDate',d+3))#>>'{}')::uuid;
 perform pg_temp.expect_challenge_error('club.saveChallenge',args||jsonb_build_object('category','other'));
 perform pg_temp.expect_challenge_error('club.saveChallenge',args||jsonb_build_object('goalType','daily_checkin','target',10));
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform public.bookcircle_mutate('club.joinChallenge',jsonb_build_object('id',total_ch));
 perform public.bookcircle_mutate('club.joinChallenge',jsonb_build_object('id',total_ch));
 perform public.bookcircle_mutate('club.joinChallenge',jsonb_build_object('id',check_ch));
 perform public.bookcircle_mutate('club.joinChallenge',jsonb_build_object('id',minimum_ch));
 perform public.bookcircle_mutate('club.joinChallenge',jsonb_build_object('id',upcoming_ch));
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',upcoming_ch,'date',d+1,'value',1));
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',total_ch,'date',d,'value',5.25));
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',check_ch,'date',d,'successful',false));
 select value into j from jsonb_array_elements(public.bookcircle_query('club.challenges')) where value->'challenge'->>'_id'=check_ch::text;
 if (j->>'progress')::numeric<>0 then raise exception 'False check-in counted'; end if;
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',check_ch,'date',d,'successful',true));
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',minimum_ch,'date',d,'value',7999));
 select value into j from jsonb_array_elements(public.bookcircle_query('club.challenges')) where value->'challenge'->>'_id'=minimum_ch::text;
 if (j->>'progress')::numeric<>0 then raise exception 'Below minimum counted'; end if;
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',minimum_ch,'date',d,'value',8000));
 select value into j from jsonb_array_elements(public.bookcircle_query('club.challenges')) where value->'challenge'->>'_id'=minimum_ch::text;
 if (j->>'progress')::numeric<>1 then raise exception 'Minimum boundary not counted'; end if;
 select value into j from jsonb_array_elements(public.bookcircle_query('club.challenges')) where value->'challenge'->>'_id'=total_ch::text;
 if (j->>'progress')::numeric<>5.25 or not (j->>'completed')::boolean then raise exception 'Decimal total failed'; end if;
 select value into j from jsonb_array_elements(public.bookcircle_query('club.challenges')) where value->'challenge'->>'_id'=check_ch::text;
 if (j->>'progress')::numeric<>1 or not (j->>'completed')::boolean then raise exception 'Check-in completion failed'; end if;
 -- Manual ties use shared ranks and expose only aggregates.
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 perform public.bookcircle_mutate('club.joinChallenge',jsonb_build_object('id',total_ch));
 perform public.bookcircle_mutate('club.saveChallengeEntry',jsonb_build_object('id',total_ch,'date',d,'value',5.25));
 select value into j from jsonb_array_elements(public.bookcircle_query('club.challenges')) where value->'challenge'->>'_id'=total_ch::text;
 if jsonb_array_length(j->'leaderboard')<>2 or j->'leaderboard'->0->>'rank'<>'1' or j->'leaderboard'->1->>'rank'<>'1' or j->'leaderboard'->0 ? 'value' then raise exception 'Manual ranking failed'; end if;
 perform set_config('request.jwt.claim.sub',stranger_id::text,true);
 if public.bookcircle_query('club.challenges')<>'[]'::jsonb then raise exception 'Cross-club query leaked'; end if;
 perform pg_temp.expect_challenge_error('club.challengeEntries',jsonb_build_object('id',total_ch),true);
 perform pg_temp.expect_challenge_error('club.joinChallenge',jsonb_build_object('id',total_ch));
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',total_ch,'date',d,'value',1));
 perform set_config('role','none',true);
 update public.memberships set status='inactive' where profile_id=other_id;
 perform set_config('request.jwt.claim.sub',moderator_id::text,true);
 perform set_config('role','authenticated',true);
 perform pg_temp.expect_challenge_error('club.inviteChallengeMembers',jsonb_build_object('id',ch,'memberIds',jsonb_build_array(other_id)));
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 perform pg_temp.expect_challenge_error('club.challenges','{}',true);
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',total_ch,'date',d,'value',1));
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 select value into j from jsonb_array_elements(public.bookcircle_query('club.challenges')) where value->'challenge'->>'_id'=total_ch::text;
 if jsonb_array_length(j->'leaderboard')<>1 then raise exception 'Inactive member still ranks'; end if;
 -- Ended challenges are read-only, even for backdating or invitation management.
 perform set_config('role','none',true);
 update public.challenges set start_date=d-10,end_date=d-1 where id=total_ch;
 perform set_config('role','authenticated',true);
 perform pg_temp.expect_challenge_error('club.saveChallengeEntry',jsonb_build_object('id',total_ch,'date',d-1,'value',1));
 perform pg_temp.expect_challenge_error('club.deleteChallengeEntry',jsonb_build_object('id',total_ch,'date',d));
 perform set_config('request.jwt.claim.sub',moderator_id::text,true);
 perform pg_temp.expect_challenge_error('club.inviteChallengeMembers',jsonb_build_object('id',total_ch,'memberIds',jsonb_build_array(member_id)));
 perform set_config('role','none',true);
 if (select revision from public.club_revisions where club_id=c)<=initial_revision then raise exception 'Mutations did not refresh Realtime'; end if;
 if has_table_privilege('authenticated','public.challenge_entries','SELECT') or has_table_privilege('authenticated','public.challenge_entries','INSERT') then raise exception 'Raw entry access granted'; end if;
 if not (select relrowsecurity from pg_class where oid='public.challenge_entries'::regclass) then raise exception 'RLS missing'; end if;
 if has_function_privilege('authenticated','private.invite_challenge_members(public.challenges,jsonb)','EXECUTE') then raise exception 'Invitation helper exposed'; end if;
end $$;
rollback;
select 'General challenge invitation, tracking, privacy, and isolation checks passed' as result;
