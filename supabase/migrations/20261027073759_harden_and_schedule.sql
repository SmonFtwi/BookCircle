create or replace function private.query(operation text,args jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid(); c uuid; adm boolean; n integer=least(100,greatest(1,coalesce((args->'paginationOpts'->>'numItems')::int,30))); o integer=greatest(0,coalesce(nullif(args->'paginationOpts'->>'cursor','')::int,0)); j jsonb; x uuid; r record; today date; wk date; begin
 select club_id,role='admin' into c,adm from memberships where profile_id=u and status='active';
 if operation='profiles.configuration' then return '{"passwordResetEnabled":true}'; end if;
 if c is null then if operation='profiles.me' then return null; end if; raise exception 'Active membership required' using errcode='42501'; end if;
 if operation like 'admin.%' and not adm then raise exception 'Administrator access required' using errcode='42501'; end if;
 today=(now() at time zone (select timezone from profiles where id=u))::date; wk=date_trunc('week',today)::date;
 case operation
 when 'profiles.me' then select jsonb_build_object('profile',private.dto(to_jsonb(p))||jsonb_build_object('authId',u),'membership',private.dto(to_jsonb(m)),'club',private.dto(to_jsonb(cl)),'avatarUrl',p.avatar_url) into j from profiles p join memberships m on m.profile_id=p.id join clubs cl on cl.id=m.club_id where p.id=u;
 when 'profiles.directory' then select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',m.role) order by p.name),'[]') into j from memberships m join profiles p on p.id=m.profile_id where m.club_id=c and m.status='active';
 when 'reading.library' then select coalesce(jsonb_agg(private.dto(to_jsonb(b)) order by b.title),'[]') into j from books b where club_id=c;
 when 'reading.myBooks' then select coalesce(jsonb_agg(jsonb_build_object('entry',private.dto(to_jsonb(ub)),'book',private.dto(to_jsonb(b)))),'[]') into j from user_books ub join books b on b.id=ub.book_id where ub.profile_id=u and b.club_id=c;
 when 'reading.logs' then select private.page(coalesce(jsonb_agg(private.dto(to_jsonb(t))),'[]'),n,o) into j from (select * from reading_logs where profile_id=u order by date desc,created_at desc,id limit n+1 offset o)t;
 when 'reading.reflections' then select coalesce(jsonb_agg(private.dto(to_jsonb(t))),'[]') into j from (select * from reflections where profile_id=u order by created_at desc,id limit 500)t;
 when 'reading.stats' then
 select jsonb_build_object('totals',private.totals(u),'week',jsonb_build_object('minutes',coalesce(sum(minutes),0),'pages',coalesce(sum(pages),0),'days',count(distinct date)),
 'goals',(select to_jsonb(g)-'profile_id' from reading_goals g where profile_id=u),
 'calendar',coalesce((select jsonb_agg(z order by z.date) from(select date,sum(minutes) minutes,sum(pages) pages from reading_logs where profile_id=u and date>=today-364 group by date)z),'[]'),
 'streak',(with dates as(select distinct date from reading_logs where profile_id=u and date<=today), seq as(select date, (row_number() over(order by date desc))::int rn from dates) select count(*) from seq where date=(select max(date) from dates)-rn+1 and (select max(date) from dates)>=today-1)) into j from reading_logs where profile_id=u and date>=wk and date<=today;
 when 'community.feed' then select private.page(coalesce(jsonb_agg(jsonb_build_object('post',private.dto(to_jsonb(t))||jsonb_build_object('commentCount',(select count(*) from insight_comments where insight_id=t.id),'helpful',(select count(*) from insight_reactions where insight_id=t.id and type='helpful'),'interesting',(select count(*) from insight_reactions where insight_id=t.id and type='interesting'),'applied',(select count(*) from insight_reactions where insight_id=t.id and type='applied')),'author',private.author(t.author_id),'bookTitle',(select title from books where id=t.book_id),'myReactions',coalesce((select jsonb_agg(type) from insight_reactions where insight_id=t.id and profile_id=u),'[]'))),'[]'),n,o) into j from(select * from insights where club_id=c order by created_at desc,id limit n+1 offset o)t;
 when 'community.comments' then
 if not exists(select 1 from insights where id=(args->>'id')::uuid and club_id=c) then raise exception 'Insight not found'; end if;
 select private.page(coalesce(jsonb_agg(jsonb_build_object('comment',private.dto(to_jsonb(t)),'author',private.author(t.author_id),'isMine',t.author_id=u)),'[]'),n,o) into j from(select * from insight_comments where insight_id=(args->>'id')::uuid order by created_at,id limit n+1 offset o)t;
 when 'forum.categories' then select coalesce(jsonb_agg(private.dto(to_jsonb(t)) order by name),'[]') into j from forum_categories t where club_id=c and (active or adm);
 when 'forum.list','forum.search' then
 select coalesce(jsonb_agg(private.question(t,u)),'[]') into j from(select q.* from forum_questions q where club_id=c and not removed and (nullif(args->>'categoryId','') is null or category_id=(args->>'categoryId')::uuid)
 and (coalesce(args->>'mode','recent')<>'mine' or author_id=u) and (coalesce(args->>'mode','recent')<>'unanswered' or not exists(select 1 from forum_answers where question_id=q.id and not removed))
 and (operation<>'forum.search' or title ilike '%'||(args->>'text')||'%' or content ilike '%'||(args->>'text')||'%')
 order by pinned desc,case when args->>'mode'='trending' then (select count(*) from forum_votes where question_id=q.id) else 0 end desc,created_at desc,id limit n+1 offset o)t;
 if operation='forum.list' then j=private.page(j,n,o); end if;
 when 'forum.detail' then select private.question(t,u) into j from forum_questions t where id=(args->>'questionId')::uuid and club_id=c and not removed; if j is null then raise exception 'Question not found'; end if;
 when 'forum.answers' then
 if not exists(select 1 from forum_questions where id=(args->>'questionId')::uuid and club_id=c and not removed) then raise exception 'Question not found'; end if;
 select private.page(coalesce(jsonb_agg(jsonb_build_object('id',t.id,'createdAt',extract(epoch from t.created_at)*1000,'questionId',t.question_id,'parentId',t.parent_id,'content',case when t.removed then '[Removed]' else t.content end,'anonymous',t.anonymous,'author',private.author(t.author_id,t.anonymous or t.removed),'isMine',t.author_id=u,'votes',(select count(*) from forum_votes where answer_id=t.id),'myVote',exists(select 1 from forum_votes where answer_id=t.id and profile_id=u),'accepted',exists(select 1 from forum_questions where accepted_answer_id=t.id),'removed',t.removed)),'[]'),n,o) into j from(select * from forum_answers where question_id=(args->>'questionId')::uuid order by created_at,id limit n+1 offset o)t;
 when 'forum.moderationIdentity' then
 if not adm then raise exception 'Administrator access required'; end if;
 select author_id into x from forum_questions where id=(args->>'questionId')::uuid and club_id=c;
 if args ? 'answerId' then select author_id into x from forum_answers where id=(args->>'answerId')::uuid and question_id=(args->>'questionId')::uuid and x is not null; end if;
 select jsonb_build_object('name',name,'email',email) into j from profiles where id=x;
 when 'club.commitments' then select coalesce(jsonb_agg(private.dto(to_jsonb(t)) order by target_date),'[]') into j from commitments t where profile_id=u;
 when 'club.weeklyReview' then select private.dto(to_jsonb(t)) into j from weekly_reviews t where profile_id=u and week=args->>'week';
 when 'club.partner' then
 select case when first_id=u then second_id else first_id end into x from accountability_partners where club_id=c and u in(first_id,second_id) limit 1;
 if x is null or not exists(select 1 from memberships where profile_id=x and status='active') then return null; end if;
 select jsonb_build_object('profileId',p.id,'name',p.name,'avatarUrl',p.avatar_url,'totals',private.totals(x),
 'commitments',coalesce((select jsonb_agg(private.dto(to_jsonb(t))) from commitments t where profile_id=x and shared),'[]'),
 'readingLogs',case when p.share_reading_details then coalesce((select jsonb_agg(private.dto(to_jsonb(t))) from(select * from reading_logs where profile_id=x order by date desc limit 30)t),'[]') else '[]'::jsonb end,
 'encouragements',coalesce((select jsonb_agg(private.dto(to_jsonb(t))) from(select * from encouragements where sender_id in(u,x) and recipient_id in(u,x) order by created_at desc limit 30)t),'[]')) into j from profiles p where p.id=x;
 when 'club.challenges' then
 select coalesce(jsonb_agg(jsonb_build_object('challenge',private.dto(to_jsonb(ch)),'joined',exists(select 1 from challenge_participants where challenge_id=ch.id and profile_id=u),'progress',private.challenge_progress(ch,u),'completed',private.challenge_progress(ch,u)>=ch.target,'participants',coalesce((select jsonb_agg(jsonb_build_object('profileId',cp.profile_id,'name',p.name)) from challenge_participants cp join profiles p on p.id=cp.profile_id where challenge_id=ch.id),'[]')) order by ch.start_date desc),'[]') into j from challenges ch where club_id=c;
 when 'club.votingRounds' then
 select coalesce(jsonb_agg(jsonb_build_object('round',private.dto(to_jsonb(v))||case when deadline<=now() then jsonb_build_object('status','closed','winnerId',private.winner(v.id)) else '{}'::jsonb end,'myVote',(select nomination_id from book_votes where round_id=v.id and profile_id=u),'nominations',coalesce((select jsonb_agg(jsonb_build_object('_id',bn.id,'book',private.dto(to_jsonb(b)),'votes',case when v.status='closed' or v.deadline<=now() then (select count(*) from book_votes where nomination_id=bn.id) else null end,'percentage',case when v.status='closed' or v.deadline<=now() then round(100.0*(select count(*) from book_votes where nomination_id=bn.id)/greatest(1,(select count(*) from book_votes where round_id=v.id))) else null end)) from book_nominations bn join books b on b.id=bn.book_id where bn.round_id=v.id),'[]')) order by v.created_at desc),'[]') into j from voting_rounds v where club_id=c;
 when 'club.meetings' then select coalesce(jsonb_agg(jsonb_build_object('meeting',private.dto(to_jsonb(m)),'rsvp',(select private.dto(to_jsonb(t)) from meeting_rsvps t where meeting_id=m.id and profile_id=u),'review',(select private.dto(to_jsonb(t)) from book_reviews t where meeting_id=m.id and profile_id=u)) order by starts_at),'[]') into j from meetings m where club_id=c;
 when 'club.meetingAgenda' then
 select jsonb_build_object('meeting',private.dto(to_jsonb(m)),'rsvps',coalesce((select jsonb_agg(private.dto(to_jsonb(t))) from meeting_rsvps t where meeting_id=m.id),'[]'),'reviews',coalesce((select jsonb_agg(private.dto(to_jsonb(t))) from book_reviews t where meeting_id=m.id),'[]')) into j from meetings m where id=(args->>'meetingId')::uuid and club_id=c;
 if j is null then raise exception 'Meeting not found'; end if;
 when 'notifications.list' then select coalesce(jsonb_agg(private.dto(to_jsonb(t))),'[]') into j from(select * from notifications where profile_id=u order by created_at desc limit 100)t;
 when 'admin.overview' then select jsonb_build_object('club',private.dto(to_jsonb(cl)),'counts',jsonb_build_object('members',(select count(*) from memberships where club_id=c and status='active'),'sessions',(select count(*) from reading_logs where club_id=c),'insights',(select count(*) from insights where club_id=c),'questions',(select count(*) from forum_questions where club_id=c and not removed))) into j from clubs cl where id=c;
 when 'admin.members' then select coalesce(jsonb_agg(jsonb_build_object('membership',private.dto(to_jsonb(m)),'name',p.name,'email',p.email,'lastActiveAt',extract(epoch from p.last_active_at)*1000)),'[]') into j from memberships m join profiles p on p.id=m.profile_id where m.club_id=c;
 when 'admin.invitations' then select coalesce(jsonb_agg(private.dto(to_jsonb(t)-'code_hash'-'bootstrap') order by created_at desc),'[]') into j from invitations t where club_id=c;
 when 'admin.reports' then select coalesce(jsonb_agg(private.dto(to_jsonb(t)) order by created_at desc),'[]') into j from forum_reports t where club_id=c;
 else raise exception 'Unknown query: %',operation;
 end case;
 return j;
end $$;
-- Explicitly deny raw table access; scoped RPCs are the sole application API.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename<>'club_revisions' loop
 execute format('create policy rpc_only on public.%I for all to anon,authenticated using(false) with check(false)',t.tablename);
 end loop;
end $$;
create function private.validate_invitation(code text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('clubName',c.name) from public.invitations i join public.clubs c on c.id=i.club_id
 where length(code) between 20 and 80 and i.code_hash=encode(extensions.digest(upper(trim(code)),'sha256'),'hex') and not i.revoked and i.expires_at>now() and i.uses<i.max_uses
$$;
create or replace function public.validate_invitation(code text) returns jsonb language sql stable security invoker set search_path='' as $$ select private.validate_invitation(code) $$;
grant usage on schema private to anon;
revoke all on function private.validate_invitation(text) from public;
grant execute on function private.validate_invitation(text) to anon,authenticated;

create table private.write_windows(profile_id uuid primary key references public.profiles(id) on delete cascade,window_start timestamptz not null,count int not null);
create function private.allow_write() returns void language plpgsql security definer set search_path='' as $$
declare used int;begin
 if private.member_club() is null then raise exception 'Active membership required' using errcode='42501'; end if;
 insert into private.write_windows(profile_id,window_start,count) values(auth.uid(),date_trunc('minute',now()),1)
 on conflict(profile_id) do update set window_start=excluded.window_start,count=case when private.write_windows.window_start=excluded.window_start then private.write_windows.count+1 else 1 end returning count into used;
 if used>120 then raise exception 'Please wait a minute before trying again.';end if;
end $$;
revoke all on function private.allow_write() from public,anon;
grant execute on function private.allow_write() to authenticated;
create or replace function public.bookcircle_mutate(operation text,args jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
begin perform private.allow_write();return private.mutate(operation,args);end $$;
-- Internal dispatch is only accessible through authenticated, explicitly checked entrypoints.
-- Private schema is not exposed by PostgREST.

create function private.can_read_avatar(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.memberships m on m.profile_id=p.id where p.avatar_url=path and m.club_id=private.member_club()) or split_part(path,'/',1)=auth.uid()::text
$$;
revoke all on function private.can_read_avatar(text) from public,anon;
grant execute on function private.can_read_avatar(text) to authenticated;
drop policy avatar_read on storage.objects;
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='avatars' and (select private.member_club()) is not null and private.can_read_avatar(name));

alter table public.notifications add column dedupe_key text;
create unique index notifications_dedupe on public.notifications(profile_id,dedupe_key) where dedupe_key is not null;
create extension if not exists pg_cron;
create function private.scheduled_work() returns void language plpgsql security definer set search_path='' as $$
begin
 update public.voting_rounds set status='closed',winner_id=private.winner(id) where status='open' and deadline<=now();
 insert into public.notifications(profile_id,title,body,href,dedupe_key)
 select r.profile_id,'Meeting tomorrow',m.title,'/meetings','meeting:'||m.id
 from public.meeting_rsvps r join public.meetings m on m.id=r.meeting_id join public.profiles p on p.id=r.profile_id join public.memberships mb on mb.profile_id=p.id and mb.club_id=m.club_id
 where r.status in('going','maybe') and m.starts_at between now() and now()+interval '24 hours' and p.notifications_enabled and mb.status='active' on conflict do nothing;
 insert into public.notifications(profile_id,title,body,href,dedupe_key)
 select cm.profile_id,'A commitment is due',cm.title,'/accountability','commitment:'||cm.id||':'||cm.target_date
 from public.commitments cm join public.profiles p on p.id=cm.profile_id join public.memberships mb on mb.profile_id=p.id
 where cm.status='pending' and cm.target_date<=(now() at time zone p.timezone)::date and p.notifications_enabled and mb.status='active' on conflict do nothing;
 insert into public.notifications(profile_id,title,body,href,dedupe_key)
 select p.id,'A moment to reflect','Review your reading week and choose one small improvement.','/accountability','weekly:'||date_trunc('week',now() at time zone p.timezone)::date
 from public.profiles p join public.memberships m on m.profile_id=p.id
 where p.notifications_enabled and m.status='active' and extract(isodow from now() at time zone p.timezone)=7 on conflict do nothing;
 update public.challenge_participants cp set completed_at=now() from public.challenges ch where ch.id=cp.challenge_id and cp.completed_at is null and private.challenge_progress(ch,cp.profile_id)>=ch.target;
 update public.club_revisions set revision=revision+1;
end $$;
revoke all on function private.scheduled_work() from public,anon,authenticated;
select cron.schedule('bookcircle-hourly','5 * * * *','select private.scheduled_work()');

-- Cover foreign keys and common ordered member/club reads.
do $$ declare r record;begin
 for r in select conrelid::regclass tab,att.attname col from pg_constraint con join pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1] where con.contype='f' and con.connamespace='public'::regnamespace
 and not exists(select 1 from pg_index i where i.indrelid=con.conrelid and i.indkey[0]=con.conkey[1]) loop
 execute format('create index if not exists %I on %s (%I)',replace(r.tab::text,'public.','')||'_'||r.col||'_fk',r.tab,r.col);
 end loop;
end $$;
create index insights_feed on public.insights(club_id,created_at desc,id);
create index questions_feed on public.forum_questions(club_id,pinned desc,created_at desc,id) where not removed;
create index reading_logs_history on public.reading_logs(profile_id,date desc,created_at desc,id);
create index reflections_history on public.reflections(profile_id,created_at desc,id);
