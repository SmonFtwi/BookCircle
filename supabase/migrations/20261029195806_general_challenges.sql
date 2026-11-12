-- General-purpose challenges. Legacy goals and accepted memberships keep their behavior.
alter table public.challenges
 add column category text not null default 'reading' check(category in('reading','fitness','diet','screen_time','other')),
 add column category_label text,
 add column participation_mode text not null default 'open' check(participation_mode in('open','invite_only')),
 add column unit text,
 add column daily_threshold numeric(14,2),
 add column comparison text check(comparison in('minimum','maximum'));
alter table public.challenges drop constraint challenges_goal_type_check;
alter table public.challenges add constraint challenges_goal_type_check check(goal_type in('minutes','days','insights','commitments','total','daily_number','daily_checkin'));
alter table public.challenges drop constraint challenges_target_check;
alter table public.challenges alter column target type numeric(14,2);
alter table public.challenges add constraint challenges_target_check check(target>0 and target<=1000000000);
alter table public.challenges add constraint challenge_configuration check (
 (category<>'other' or (category_label is not null and length(trim(category_label)) between 1 and 60))
 and (goal_type not in('total','daily_number') or (unit is not null and length(trim(unit)) between 1 and 40))
 and (goal_type<>'daily_number' or (daily_threshold is not null and daily_threshold>=0 and daily_threshold<=1000000000 and comparison is not null))
 and (goal_type not in('daily_number','daily_checkin') or (target=trunc(target) and target<=end_date-start_date+1))
);
alter table public.challenge_participants
 add column status text not null default 'accepted' check(status in('invited','accepted','declined','revoked')),
 add column accepted_date date;
update public.challenge_participants cp set accepted_date=(cp.joined_at at time zone p.timezone)::date from public.profiles p where p.id=cp.profile_id;
create table public.challenge_entries (
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 date date not null,
 value numeric(14,2),
 successful boolean,
 primary key(challenge_id,profile_id,date),
 foreign key(challenge_id,profile_id) references public.challenge_participants(challenge_id,profile_id) on delete cascade,
 check ((value is not null and value>=0 and value<=1000000000 and successful is null) or (value is null and successful is not null))
);
create index challenge_entries_owner on public.challenge_entries(profile_id);
alter table public.challenge_entries enable row level security;
revoke all on public.challenge_entries from public,anon,authenticated;
-- Raw table access stays revoked, as with the rest of the application. RPCs enforce ownership.

alter function private.challenge_progress(public.challenges,uuid) rename to automatic_challenge_progress;
create function private.challenge_progress(ch public.challenges,u uuid) returns numeric language sql stable set search_path='' as $$
 select case when ch.goal_type in('minutes','days','insights','commitments') then private.automatic_challenge_progress(ch,u)
 else (select case ch.goal_type
   when 'total' then coalesce(sum(e.value),0)
   when 'daily_number' then count(*) filter(where (ch.comparison='minimum' and e.value>=ch.daily_threshold) or (ch.comparison='maximum' and e.value<=ch.daily_threshold))
   when 'daily_checkin' then count(*) filter(where e.successful)
 end from public.challenge_entries e join public.challenge_participants cp on cp.challenge_id=e.challenge_id and cp.profile_id=e.profile_id
 where e.challenge_id=ch.id and e.profile_id=u and cp.status='accepted' and e.date between greatest(ch.start_date,cp.accepted_date) and ch.end_date) end
$$;
revoke all on function private.challenge_progress(public.challenges,uuid) from public,anon,authenticated;

create or replace function private.challenge_leaderboard(ch public.challenges) returns jsonb
language sql stable set search_path='' as $$
 with scores as (
   select p.id, p.name, private.challenge_progress(ch,p.id) as progress
   from public.challenge_participants cp
   join public.profiles p on p.id=cp.profile_id
   join public.memberships m on m.profile_id=p.id and m.club_id=ch.club_id and m.status='active'
   where cp.challenge_id=ch.id and cp.status='accepted'
 ), leaders as (
   select id,name,progress,rank() over(order by progress desc) as rank
   from scores where progress>0
   order by progress desc,id limit 3
 )
 select coalesce(jsonb_agg(jsonb_build_object('profileId',id,'name',name,'rank',rank,'progress',progress)
   order by progress desc,id),'[]'::jsonb) from leaders
$$;
revoke all on function private.challenge_leaderboard(public.challenges) from public,anon,authenticated;


-- Broadcast only in-app notifications to active, opted-in club members.
create or replace function private.activity_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='challenges' then
 if new.participation_mode='invite_only' then return new; end if;
 insert into public.notifications(profile_id,title,body,href,dedupe_key)
 select m.profile_id,'A new club challenge',new.title,'/challenges','challenge:'||new.id
 from public.memberships m join public.profiles p on p.id=m.profile_id
 where m.club_id=new.club_id and m.status='active' and p.notifications_enabled on conflict do nothing;
 elsif new.weekly_prompt is distinct from old.weekly_prompt and nullif(trim(new.weekly_prompt),'') is not null then
 insert into public.notifications(profile_id,title,body,href)
 select m.profile_id,'A new discussion prompt',new.weekly_prompt,'/community'
 from public.memberships m join public.profiles p on p.id=m.profile_id
 where m.club_id=new.id and m.status='active' and p.notifications_enabled;
 end if;
 return new;
end $$;

-- Internal helper, called only after manager authorization and the club write lock.
create function private.invite_challenge_members(ch public.challenges,member_ids jsonb) returns void language plpgsql set search_path='' as $$
declare member_id uuid; changed uuid;
begin
 if ch.participation_mode<>'invite_only' then raise exception 'This challenge is open to the club'; end if;
 if jsonb_typeof(member_ids)<>'array' then raise exception 'Choose club members'; end if;
 for member_id in select distinct value::uuid from jsonb_array_elements_text(member_ids) loop
 if not exists(select 1 from public.memberships where profile_id=member_id and club_id=ch.club_id and status='active') then raise exception 'Select active members of this club only'; end if;
 changed=null;
 insert into public.challenge_participants(challenge_id,profile_id,status,accepted_date) values(ch.id,member_id,'invited',null)
 on conflict(challenge_id,profile_id) do update set status='invited',accepted_date=null where challenge_participants.status in('declined','revoked') returning profile_id into changed;
 if changed is not null then
 insert into public.notifications(profile_id,title,body,href,dedupe_key)
 select member_id,'You’re invited to a challenge',ch.title,'/challenges','challenge-invite:'||ch.id||':'||member_id from public.profiles where id=member_id and notifications_enabled
 on conflict(profile_id,dedupe_key) where dedupe_key is not null do update set body=excluded.body,read=false,created_at=now();
 end if;
 end loop;
end $$;
revoke all on function private.invite_challenge_members(public.challenges,jsonb) from public,anon,authenticated;

create or replace function private.query(operation text,args jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid(); c uuid; adm boolean; staff boolean; n integer=least(100,greatest(1,coalesce((args->'paginationOpts'->>'numItems')::int,30))); o integer=greatest(0,coalesce(nullif(args->'paginationOpts'->>'cursor','')::int,0)); j jsonb; x uuid; r record; today date; wk date; begin
 select club_id,role='admin',role in('admin','moderator') into c,adm,staff from memberships where profile_id=u and status='active';
 if operation='profiles.configuration' then return '{"passwordResetEnabled":true}'; end if;
 if c is null then if operation='profiles.me' then return null; end if; raise exception 'Active membership required' using errcode='42501'; end if;
 if operation like 'admin.%' and not (adm or (staff and operation in('admin.overview','admin.reports'))) then raise exception 'Administrator access required' using errcode='42501'; end if;
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
 when 'forum.categories' then select coalesce(jsonb_agg(private.dto(to_jsonb(t)) order by name),'[]') into j from forum_categories t where club_id=c and (active or staff);
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
 if not staff then raise exception 'Content manager access required'; end if;
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
 when 'club.challengeMembers' then
 if not staff then raise exception 'Content manager access required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('profileId',p.id,'name',p.name) order by p.name,p.id),'[]') into j from memberships m join profiles p on p.id=m.profile_id where m.club_id=c and m.status='active';
 when 'club.challengeEntries' then
 if not exists(select 1 from challenges ch join challenge_participants cp on cp.challenge_id=ch.id where ch.id=(args->>'id')::uuid and ch.club_id=c and cp.profile_id=u and cp.status='accepted') then raise exception 'Challenge unavailable' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('date',e.date,'value',e.value,'successful',e.successful) order by e.date desc),'[]') into j from challenge_entries e where e.challenge_id=(args->>'id')::uuid and e.profile_id=u;
 when 'club.challenges' then
 select coalesce(jsonb_agg(jsonb_build_object(
 'challenge',private.dto(to_jsonb(ch)),
 'joined',coalesce(me.status='accepted',false),
 'participationStatus',me.status,'acceptedDate',me.accepted_date,
 'progress',case when me.status='accepted' then private.challenge_progress(ch,u) else 0 end,
 'completed',coalesce(me.status='accepted' and private.challenge_progress(ch,u)>=ch.target,false),
 'leaderboard',private.challenge_leaderboard(ch),
 'invitations',case when staff then coalesce((select jsonb_agg(jsonb_build_object('profileId',cp.profile_id,'name',p.name,'status',cp.status) order by p.name) from challenge_participants cp join profiles p on p.id=cp.profile_id join memberships m on m.profile_id=p.id and m.club_id=c and m.status='active' where cp.challenge_id=ch.id),'[]') else '[]'::jsonb end,
 'participants',coalesce((select jsonb_agg(jsonb_build_object('profileId',cp.profile_id,'name',p.name)) from challenge_participants cp join profiles p on p.id=cp.profile_id join memberships m on m.profile_id=p.id and m.club_id=ch.club_id and m.status='active' where cp.challenge_id=ch.id and cp.status='accepted'),'[]')) order by ch.start_date desc,ch.id),'[]') into j
 from challenges ch left join challenge_participants me on me.challenge_id=ch.id and me.profile_id=u
 where ch.club_id=c and (ch.participation_mode='open' or staff or me.status in('invited','accepted','declined'));
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

create or replace function private.mutate(operation text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid(); c uuid; adm boolean; staff boolean; x uuid=nullif(args->>'id','')::uuid; b uuid=nullif(args->>'bookId','')::uuid; q uuid=nullif(args->>'questionId','')::uuid; a uuid=nullif(args->>'answerId','')::uuid; t uuid; p uuid; rr record; result jsonb='null'; code text; d date; ch public.challenges; cp public.challenge_participants; today date; v numeric; success boolean; begin
 select club_id,role='admin',role in('admin','moderator') into c,adm,staff from memberships where profile_id=u and status='active';
 if c is null then raise exception 'Active membership required' using errcode='42501'; end if;
 -- Serializes related writes, including votes, pairing and rate limits.
 perform pg_advisory_xact_lock(hashtextextended(c::text,0));
 -- Recheck authorization after the lock so concurrent role changes take effect.
 select club_id,role='admin',role in('admin','moderator') into c,adm,staff from memberships where profile_id=u and status='active';
 if c is null then raise exception 'Active membership required' using errcode='42501'; end if;
 if octet_length(args::text)>40000 then raise exception 'Request too large'; end if;
 if operation like 'admin.%' and operation not in('admin.resolveReport','admin.saveCategory','admin.setWeeklyPrompt') and not adm then
 raise exception 'Administrator access required' using errcode='42501'; end if;
 if operation in('admin.resolveReport','admin.saveCategory','admin.setWeeklyPrompt','reading.addBook','reading.editBook','reading.deleteBook','club.pairMembers','club.saveChallenge','club.deleteChallenge','club.inviteChallengeMembers','club.revokeChallengeInvitation','club.saveVotingRound','club.nominate','club.closeVoting','club.saveMeeting','forum.moderate') and not staff then
 raise exception 'Content manager access required' using errcode='42501'; end if;
 if b is not null and not exists(select 1 from books where id=b and club_id=c) then raise exception 'Book not found'; end if;
 if q is not null and not exists(select 1 from forum_questions where id=q and club_id=c and not removed) then raise exception 'Question not found'; end if;
 if a is not null and not exists(select 1 from forum_answers fa join forum_questions fq on fq.id=fa.question_id where fa.id=a and fq.club_id=c and not fa.removed and not fq.removed and (q is null or fa.question_id=q)) then raise exception 'Answer not found'; end if;
 case operation
 when 'profiles.update' then
 if not exists(select 1 from pg_timezone_names where name=args->>'timezone') then raise exception 'Invalid timezone'; end if;
 if length(trim(args->>'name'))<1 then raise exception 'Name is required'; end if;
 update profiles set name=trim(args->>'name'),timezone=args->>'timezone',share_reading_details=(args->>'shareReadingDetails')::boolean,notifications_enabled=(args->>'notificationsEnabled')::boolean where id=u;
 when 'profiles.setAvatar' then
 if split_part(args->>'storageId','/',1)<>u::text or not exists(select 1 from storage.objects where bucket_id='avatars' and name=args->>'storageId' and owner_id=u::text) then raise exception 'Invalid avatar'; end if;
 update profiles set avatar_url=args->>'storageId' where id=u;
 when 'reading.addBook','reading.editBook' then
 if length(trim(args->>'title'))=0 or length(trim(args->>'author'))=0 then raise exception 'Title and author are required'; end if;
 if coalesce(args->>'coverUrl','')<>'' and args->>'coverUrl' !~ '^https://' then raise exception 'Cover must use HTTPS'; end if;
 if operation='reading.addBook' then insert into books(club_id,title,author,description,cover_url,total_pages,category) values(c,trim(args->>'title'),trim(args->>'author'),args->>'description',args->>'coverUrl',(args->>'totalPages')::int,args->>'category') returning id into x; result=to_jsonb(x);
 else update books set title=trim(args->>'title'),author=trim(args->>'author'),description=args->>'description',cover_url=args->>'coverUrl',total_pages=(args->>'totalPages')::int,category=args->>'category' where id=b and club_id=c; end if;
 when 'reading.deleteBook' then
 if exists(select 1 from reading_logs where book_id=b) or exists(select 1 from user_books where book_id=b) then raise exception 'This book has reading history or is on a shelf; keep it in the library.'; end if;
 delete from books where id=b and club_id=c;
 when 'reading.setBook' then insert into user_books(profile_id,book_id,status,completed_at,current_page) values(u,b,args->>'status',case when args->>'status'='completed' then now() end,case when args->>'status'='completed' then (select total_pages from books where id=b) else 0 end) on conflict(profile_id,book_id) do update set status=excluded.status,completed_at=excluded.completed_at,current_page=case when excluded.status='completed' then excluded.current_page else user_books.current_page end,updated_at=now();
 when 'reading.removeBook' then delete from user_books where profile_id=u and book_id=b;
 when 'reading.setGoals' then insert into reading_goals(profile_id,pages,minutes,days) values(u,(args->>'pages')::int,(args->>'minutes')::int,(args->>'days')::int) on conflict(profile_id) do update set pages=excluded.pages,minutes=excluded.minutes,days=excluded.days;
 when 'reading.log' then
 d=(args->>'date')::date;
 if d>(now() at time zone (select timezone from profiles where id=u))::date or d<date '2000-01-01' then raise exception 'Choose a valid past or current reading date'; end if;
 if (args->>'endPage')::int>(select total_pages from books where id=b) then raise exception 'Page exceeds book length'; end if;
 insert into reading_logs(profile_id,club_id,book_id,date,start_page,end_page,pages,minutes,notes) values(u,c,b,d,(args->>'startPage')::int,(args->>'endPage')::int,(args->>'endPage')::int-(args->>'startPage')::int,(args->>'minutes')::int,args->>'notes') returning id into x;
 insert into user_books(profile_id,book_id,status,current_page,completed_at) values(u,b,case when (args->>'endPage')::int=(select total_pages from books where id=b) then 'completed' else 'reading' end,(args->>'endPage')::int,case when (args->>'endPage')::int=(select total_pages from books where id=b) then now() end) on conflict(profile_id,book_id) do update set current_page=greatest(user_books.current_page,excluded.current_page),status=case when excluded.status='completed' then 'completed' else user_books.status end,completed_at=coalesce(user_books.completed_at,excluded.completed_at),updated_at=now();
 if nullif(trim(args->>'reflection'),'') is not null then
 insert into reflections(profile_id,book_id,body,date) values(u,b,trim(args->>'reflection'),d);
 if coalesce((args->>'shareReflection')::boolean,false) then insert into insights(club_id,author_id,book_id,title,content) values(c,u,b,'A reading reflection',trim(args->>'reflection')); end if; end if;
 if args ? 'commitment' then insert into commitments(profile_id,club_id,book_id,title,target_date) values(u,c,b,args->'commitment'->>'title',(args->'commitment'->>'targetDate')::date); end if;
 result=to_jsonb(x);
 when 'community.create','community.update' then
 if length(trim(args->>'title'))<1 or length(trim(args->>'content'))<1 then raise exception 'Title and content are required'; end if;
 if operation='community.create' then insert into insights(club_id,author_id,book_id,title,content,chapter) values(c,u,b,trim(args->>'title'),trim(args->>'content'),args->>'chapter') returning id into x; result=to_jsonb(x);
 else update insights set title=trim(args->>'title'),content=trim(args->>'content'),chapter=args->>'chapter',book_id=b where id=x and club_id=c and (author_id=u or staff); if not found then raise exception 'Insight not found or not yours'; end if; end if;
 when 'community.remove' then delete from insights where id=x and club_id=c and (author_id=u or staff); if not found then raise exception 'Insight not found or permission denied'; end if;
 when 'community.comment','community.react' then
 select author_id into p from insights where id=x and club_id=c; if p is null then raise exception 'Insight not found'; end if;
 if operation='community.comment' then
 if length(trim(args->>'content'))<1 then raise exception 'Comment is required'; end if;
 insert into insight_comments(insight_id,author_id,content) values(x,u,trim(args->>'content')) returning id into t; result=to_jsonb(t);
 if p<>u then perform private.notify(p,'New comment','Someone replied to your insight.','/community'); end if;
 else delete from insight_reactions where insight_id=x and profile_id=u and type=args->>'type'; if not found then insert into insight_reactions(insight_id,profile_id,type) values(x,u,args->>'type'); end if; end if;
 when 'community.removeComment' then delete from insight_comments ic using insights i where ic.id=x and i.id=ic.insight_id and i.club_id=c and (ic.author_id=u or staff); if not found then raise exception 'Comment not found or permission denied'; end if;
 when 'forum.ask' then
 if not exists(select 1 from forum_categories where id=(args->>'categoryId')::uuid and club_id=c and active) then raise exception 'Choose an active category'; end if;
 if length(trim(args->>'title'))<1 or length(trim(args->>'content'))<1 then raise exception 'Title and content are required'; end if;
 insert into forum_questions(club_id,author_id,category_id,book_id,title,content,anonymous) values(c,u,(args->>'categoryId')::uuid,b,trim(args->>'title'),trim(args->>'content'),(args->>'anonymous')::boolean) returning id into x; result=to_jsonb(x);
 when 'forum.updateQuestion' then update forum_questions set title=trim(args->>'title'),content=trim(args->>'content') where id=x and club_id=c and (author_id=u or staff) and not removed and (not locked or staff); if not found then raise exception 'Question unavailable or locked'; end if;
 when 'forum.removeQuestion' then update forum_questions set removed=true where id=x and club_id=c and (author_id=u or staff); if not found then raise exception 'Question not found or permission denied'; end if;
 when 'forum.answer' then
 select * into rr from forum_questions where id=q and club_id=c and not locked and not removed; if rr.id is null then raise exception 'Question unavailable or locked'; end if;
 if args ? 'parentId' and not exists(select 1 from forum_answers where id=(args->>'parentId')::uuid and question_id=q and not removed and parent_id is null) then raise exception 'Replies support one nested level'; end if;
 if length(trim(args->>'content'))<1 then raise exception 'Answer is required'; end if;
 insert into forum_answers(question_id,author_id,parent_id,content,anonymous) values(q,u,(args->>'parentId')::uuid,trim(args->>'content'),(args->>'anonymous')::boolean) returning id into x; result=to_jsonb(x);
 if rr.author_id<>u then perform private.notify(rr.author_id,'New answer','Someone answered your question.','/forum/'||q); end if;
 when 'forum.updateAnswer','forum.removeAnswer' then
 select fq.id into q from forum_answers fa join forum_questions fq on fq.id=fa.question_id where fa.id=x and fq.club_id=c and (fa.author_id=u or staff) and not fq.removed and (not fq.locked or staff or operation='forum.removeAnswer');
 if q is null then raise exception 'Answer unavailable or permission denied'; end if;
 if operation='forum.updateAnswer' then update forum_answers set content=trim(args->>'content') where id=x and not removed;
 else update forum_answers set removed=true where id=x; update forum_questions set accepted_answer_id=null where accepted_answer_id=x; end if;
 when 'forum.vote' then
 if (q is null)=(a is null) then raise exception 'Choose one vote target'; end if;
 delete from forum_votes where profile_id=u and (question_id=q or answer_id=a); if not found then insert into forum_votes(profile_id,question_id,answer_id) values(u,q,a); end if;
 when 'forum.accept' then
 if not exists(select 1 from forum_questions where id=q and author_id=u) then raise exception 'Only the question author can accept answers'; end if;
 update forum_questions set accepted_answer_id=case when accepted_answer_id=a then null else a end where id=q;
 when 'forum.moderate' then update forum_questions set pinned=(args->>'pinned')::boolean,locked=(args->>'locked')::boolean where id=q and club_id=c;
 when 'forum.report' then insert into forum_reports(club_id,reporter_id,question_id,answer_id,reason) values(c,u,q,a,args->>'reason');
 when 'club.saveCommitment' then
 if x is null then insert into commitments(profile_id,club_id,book_id,title,description,target_date,shared) values(u,c,b,args->>'title',args->>'description',(args->>'targetDate')::date,(args->>'shared')::boolean) returning id into x;
 else update commitments set book_id=b,title=args->>'title',description=args->>'description',target_date=(args->>'targetDate')::date,shared=(args->>'shared')::boolean where id=x and profile_id=u; if not found then raise exception 'Commitment not found'; end if; end if; result=to_jsonb(x);
 when 'club.setCommitmentStatus' then update commitments set status=args->>'status',outcome=args->>'outcome',completed_at=case when args->>'status'='completed' then now() end where id=x and profile_id=u; if not found then raise exception 'Commitment not found'; end if;
 when 'club.deleteCommitment' then delete from commitments where id=x and profile_id=u; if not found then raise exception 'Commitment not found'; end if;
 when 'club.saveWeeklyReview' then
 if (args->>'week')::date<>date_trunc('week',(args->>'week')::date)::date then raise exception 'Week must start on Monday'; end if;
 insert into weekly_reviews(profile_id,week,achieved,lesson,improvement) values(u,args->>'week',(args->>'achieved')::boolean,args->>'lesson',args->>'improvement') on conflict(profile_id,week) do update set achieved=excluded.achieved,lesson=excluded.lesson,improvement=excluded.improvement;
 when 'club.pairMembers' then
 p=(args->>'firstId')::uuid;t=(args->>'secondId')::uuid;
 if p=t or (select count(*) from memberships where club_id=c and profile_id in(p,t) and status='active')<>2 then raise exception 'Choose two active members'; end if;
 delete from accountability_partners where club_id=c and (first_id in(p,t) or second_id in(p,t));
 insert into accountability_partners(club_id,first_id,second_id) values(c,p,t);
 perform private.notify(p,'Your reading partner is ready','Visit Accountability to meet your partner.','/accountability');perform private.notify(t,'Your reading partner is ready','Visit Accountability to meet your partner.','/accountability');
 when 'club.encourage' then
 select case when first_id=u then second_id else first_id end into p from accountability_partners where club_id=c and u in(first_id,second_id);
 if p is null or not exists(select 1 from memberships where profile_id=p and status='active') then raise exception 'No active partner'; end if;
 insert into encouragements(sender_id,recipient_id,message) values(u,p,args->>'message');perform private.notify(p,'A little encouragement',args->>'message','/accountability');
 when 'club.saveChallenge' then
 if nullif(trim(args->>'title'),'') is null then raise exception 'Title is required'; end if;
 if x is null then
 insert into challenges(club_id,title,description,start_date,end_date,goal_type,target,created_by,category,category_label,participation_mode,unit,daily_threshold,comparison)
 values(c,trim(args->>'title'),coalesce(args->>'description',''),(args->>'startDate')::date,(args->>'endDate')::date,args->>'goalType',(args->>'target')::numeric,u,coalesce(args->>'category','reading'),nullif(trim(args->>'categoryLabel'),''),coalesce(args->>'participationMode','open'),nullif(trim(args->>'unit'),''),(args->>'dailyThreshold')::numeric,args->>'comparison') returning * into ch;
 x=ch.id;
 if ch.participation_mode='invite_only' then perform private.invite_challenge_members(ch,coalesce(args->'memberIds','[]')); end if;
 else
 -- Goal configuration and dates cannot change underneath participant entries.
 update challenges set title=trim(args->>'title'),description=coalesce(args->>'description','') where id=x and club_id=c;
 if not found then raise exception 'Challenge not found'; end if;
 end if;
 result=to_jsonb(x);
 when 'club.deleteChallenge' then
 delete from notifications where dedupe_key like 'challenge-invite:'||x||':%' and exists(select 1 from challenges where id=x and club_id=c);
 delete from challenges where id=x and club_id=c;
 when 'club.inviteChallengeMembers','club.revokeChallengeInvitation','club.joinChallenge','club.respondChallengeInvitation','club.saveChallengeEntry','club.deleteChallengeEntry' then
 select * into ch from challenges where id=x and club_id=c;
 today=(now() at time zone (select timezone from profiles where id=u))::date;
 if ch.id is null then raise exception 'Challenge unavailable' using errcode='42501'; end if;
 select * into cp from challenge_participants where challenge_id=x and profile_id=u;
 if ch.participation_mode='invite_only' and not staff and coalesce(cp.status,'revoked') not in('invited','accepted','declined') then raise exception 'Challenge unavailable' using errcode='42501'; end if;
 if ch.end_date<today then raise exception 'This challenge has ended'; end if;
 if operation='club.inviteChallengeMembers' then
 perform private.invite_challenge_members(ch,coalesce(args->'memberIds','[]'));
 elsif operation='club.revokeChallengeInvitation' then
 update challenge_participants set status='revoked' where challenge_id=x and profile_id=(args->>'profileId')::uuid and status='invited';
 if not found then raise exception 'Only pending invitations can be revoked'; end if;
 delete from notifications where profile_id=(args->>'profileId')::uuid and dedupe_key='challenge-invite:'||x||':'||(args->>'profileId');
 elsif operation in('club.joinChallenge','club.respondChallengeInvitation') then
 if operation='club.joinChallenge' and ch.participation_mode<>'open' then raise exception 'Accept your invitation to join'; end if;
 if operation='club.respondChallengeInvitation' then
 if args->>'response' is null or args->>'response' not in('accepted','declined') then raise exception 'Invalid invitation response'; end if;
 if cp.status=args->>'response' then return 'null'::jsonb; end if;
 if cp.status is distinct from 'invited' then raise exception 'No pending invitation'; end if;
 update challenge_participants set status=args->>'response',joined_at=case when args->>'response'='accepted' then now() else joined_at end,accepted_date=case when args->>'response'='accepted' then today end where id=cp.id;
 else
 insert into challenge_participants(challenge_id,profile_id,status,accepted_date) values(x,u,'accepted',today) on conflict(challenge_id,profile_id) do nothing;
 end if;
 else
 if cp.status is distinct from 'accepted' or ch.goal_type not in('total','daily_number','daily_checkin') then raise exception 'Join a manually tracked challenge first'; end if;
 d=(args->>'date')::date;
 if today<ch.start_date or d is null or d<greatest(ch.start_date,cp.accepted_date) or d>least(today,ch.end_date) then raise exception 'Choose a date from your participation period, up to today'; end if;
 if operation='club.deleteChallengeEntry' then
 delete from challenge_entries where challenge_id=x and profile_id=u and date=d;
 else
 v=null; success=null;
 if ch.goal_type='daily_checkin' then success=(args->>'successful')::boolean;
 else v=(args->>'value')::numeric;
 if v is null or v<0 or v>1000000000 or v<>round(v,2) then raise exception 'Enter a non-negative number with at most two decimal places'; end if;
 end if;
 insert into challenge_entries(challenge_id,profile_id,date,value,successful) values(x,u,d,v,success)
 on conflict(challenge_id,profile_id,date) do update set value=excluded.value,successful=excluded.successful;
 end if;
 update challenge_participants set completed_at=case when private.challenge_progress(ch,u)>=ch.target then coalesce(completed_at,now()) end where challenge_id=x and profile_id=u;
 end if;
 when 'club.saveVotingRound' then
 if to_timestamp((args->>'deadline')::double precision/1000)<=now() then raise exception 'Choose a future deadline'; end if;
 if x is null then insert into voting_rounds(club_id,title,deadline) values(c,args->>'title',to_timestamp((args->>'deadline')::double precision/1000)) returning id into x;
 else update voting_rounds set title=args->>'title',deadline=to_timestamp((args->>'deadline')::double precision/1000) where id=x and club_id=c and status='open' and deadline>now(); if not found then raise exception 'Round is closed'; end if; end if; result=to_jsonb(x);
 when 'club.nominate' then
 t=(args->>'roundId')::uuid;
 if not exists(select 1 from voting_rounds where id=t and club_id=c and status='open' and deadline>now()) then raise exception 'Round is closed'; end if;
 insert into book_nominations(round_id,book_id) values(t,b) on conflict do nothing;
 when 'club.vote' then
 select bn.round_id into t from book_nominations bn join voting_rounds vr on vr.id=bn.round_id where bn.id=(args->>'nominationId')::uuid and vr.club_id=c and vr.status='open' and vr.deadline>now(); if t is null then raise exception 'Round is closed'; end if;
 insert into book_votes(round_id,profile_id,nomination_id) values(t,u,(args->>'nominationId')::uuid) on conflict(round_id,profile_id) do update set nomination_id=excluded.nomination_id;
 when 'club.closeVoting' then update voting_rounds set status='closed',winner_id=private.winner(id) where id=x and club_id=c;
 when 'club.saveMeeting' then
 if x is null then insert into meetings(club_id,title,starts_at,ends_at,location,description,book_id) values(c,args->>'title',to_timestamp((args->>'startsAt')::double precision/1000),to_timestamp((args->>'endsAt')::double precision/1000),args->>'location',args->>'description',b) returning id into x;
 else update meetings set title=args->>'title',starts_at=to_timestamp((args->>'startsAt')::double precision/1000),ends_at=to_timestamp((args->>'endsAt')::double precision/1000),location=args->>'location',description=args->>'description',book_id=b where id=x and club_id=c; if not found then raise exception 'Meeting not found'; end if; end if; result=to_jsonb(x);
 when 'club.rsvp','club.reviewBook' then
 select * into rr from meetings where id=(args->>'meetingId')::uuid and club_id=c; if rr.id is null then raise exception 'Meeting not found'; end if;
 if operation='club.rsvp' then insert into meeting_rsvps(meeting_id,profile_id,status,question) values(rr.id,u,args->>'status',args->>'question') on conflict(meeting_id,profile_id) do update set status=excluded.status,question=excluded.question;
 else
 if rr.book_id is null then raise exception 'Meeting has no book'; end if;
 if jsonb_array_length(args->'lessons')<>3 then raise exception 'Share three lessons'; end if;
 insert into book_reviews(meeting_id,profile_id,book_id,lessons,applied,changed,improvement) values(rr.id,u,rr.book_id,array(select jsonb_array_elements_text(args->'lessons')),args->>'applied',args->>'changed',args->>'improvement') on conflict(meeting_id,profile_id) do update set lessons=excluded.lessons,applied=excluded.applied,changed=excluded.changed,improvement=excluded.improvement; end if;
 when 'notifications.markRead' then update notifications set read=true where profile_id=u and (x is null or id=x);
 when 'admin.setMemberRole' then
 if args->>'role' is null or args->>'role' not in('admin','moderator','member') then raise exception 'Choose a valid role';end if;
 select * into rr from memberships where id=x and club_id=c;
 if rr.id is null then raise exception 'Member not found';end if;
 if rr.role='admin' and rr.status='active' and args->>'role'<>'admin' and (select count(*) from memberships where club_id=c and role='admin' and status='active')<=1 then
 raise exception 'The club must keep at least one active administrator';end if;
 update memberships set role=args->>'role' where id=x;
 when 'admin.setMemberStatus' then
 select * into rr from memberships where id=x and club_id=c; if rr.id is null then raise exception 'Member not found'; end if;
 if args->>'status'='inactive' and rr.role='admin' and (select count(*) from memberships where club_id=c and role='admin' and status='active')<=1 then raise exception 'The last active administrator cannot be deactivated'; end if;
 update memberships set status=args->>'status' where id=x;
 when 'admin.generateInvitation' then
 if (args->>'expiresInDays')::int not between 1 and 90 then raise exception 'Expiry must be 1–90 days'; end if;
 code=upper(encode(extensions.gen_random_bytes(16),'hex'));
 insert into invitations(club_id,code_hash,expires_at,max_uses,created_by) values(c,encode(extensions.digest(code,'sha256'),'hex'),now()+make_interval(days=>(args->>'expiresInDays')::int),(args->>'maxUses')::int,u) returning id into x;
 result=jsonb_build_object('id',x,'code',code);
 when 'admin.revokeInvitation' then update invitations set revoked=true where id=x and club_id=c;
 when 'admin.resolveReport' then update forum_reports set resolved=true where id=x and club_id=c;
 when 'admin.saveCategory' then
 if x is null then insert into forum_categories(club_id,name,active) values(c,args->>'name',(args->>'active')::boolean) returning id into x;
 else update forum_categories set name=args->>'name',active=(args->>'active')::boolean where id=x and club_id=c; if not found then raise exception 'Category not found'; end if; end if; result=to_jsonb(x);
 when 'admin.setWeeklyPrompt' then update clubs set weekly_prompt=args->>'prompt' where id=c;
 else raise exception 'Unknown mutation: %',operation;
 end case;
 update profiles set last_active_at=now() where id=u;
 update club_revisions set revision=revision+1 where club_id=c;
 return result;
end $$;

