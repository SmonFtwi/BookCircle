-- ==============================================================================
-- BookCircle: Complete Supabase PostgreSQL Schema & Security Policies
-- ==============================================================================

-- Enable UUID extension
create extension if not exists pgcrypto with schema extensions;

-- 1. Clubs
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 100),
  description text default '',
  weekly_prompt text,
  created_at timestamptz default now()
);

-- 2. Profiles (Linked to Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  email text not null,
  timezone text default 'UTC',
  avatar_url text,
  share_reading_details boolean default false,
  notifications_enabled boolean default true,
  joined_at timestamptz default now(),
  last_active_at timestamptz default now()
);

-- 3. Memberships
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  status text not null check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  unique (club_id, profile_id)
);
create index if not exists idx_memberships_profile on public.memberships(profile_id);
create index if not exists idx_memberships_club on public.memberships(club_id);

-- 4. Invitations (Hashed codes for security)
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  uses integer not null default 0,
  revoked boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists idx_invitations_hash on public.invitations(code_hash);
create index if not exists idx_invitations_club on public.invitations(club_id);

-- 5. Invitation Redemptions
create table if not exists public.invitation_redemptions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz default now()
);

-- 6. Books (Club Library)
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  author text not null check (char_length(author) <= 120),
  description text default '',
  cover_url text default '',
  total_pages integer not null check (total_pages between 1 and 20000),
  category text not null default 'Personal Growth',
  created_at timestamptz default now()
);
create index if not exists idx_books_club on public.books(club_id);

-- 7. User Books (Member personal shelf)
create table if not exists public.user_books (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null check (status in ('want', 'reading', 'completed', 'paused')),
  current_page integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  unique (profile_id, book_id)
);
create index if not exists idx_user_books_profile on public.user_books(profile_id);

-- 8. Reading Logs (Session history)
create table if not exists public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  date date not null default current_date,
  start_page integer not null default 0,
  end_page integer not null check (end_page >= start_page),
  pages integer not null default 0,
  minutes integer not null check (minutes between 1 and 1440),
  notes text default '',
  created_at timestamptz default now()
);
create index if not exists idx_reading_logs_profile_date on public.reading_logs(profile_id, date);
create index if not exists idx_reading_logs_club_date on public.reading_logs(club_id, date);

-- 9. Reading Totals & Goals
create table if not exists public.reading_totals (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  minutes integer default 0,
  pages integer default 0,
  days integer default 0,
  sessions integer default 0,
  books integer default 0
);

create table if not exists public.reading_goals (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  pages integer not null default 100 check (pages >= 0),
  minutes integer not null default 150 check (minutes >= 0),
  days integer not null default 5 check (days between 1 and 7)
);

-- 10. Private Reflections
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  body text not null check (char_length(body) <= 10000),
  date date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists idx_reflections_profile on public.reflections(profile_id);

-- 11. Insights (Community Feed)
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title text not null check (char_length(title) <= 200),
  content text not null check (char_length(content) <= 10000),
  chapter text default '',
  comment_count integer default 0,
  helpful integer default 0,
  interesting integer default 0,
  applied integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_insights_club on public.insights(club_id);
create index if not exists idx_insights_author on public.insights(author_id);

-- 12. Insight Comments & Reactions
create table if not exists public.insight_comments (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references public.insights(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 3000),
  created_at timestamptz default now()
);
create index if not exists idx_insight_comments_insight on public.insight_comments(insight_id);

create table if not exists public.insight_reactions (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references public.insights(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('helpful', 'interesting', 'applied')),
  created_at timestamptz default now(),
  unique (insight_id, profile_id, type)
);

-- 13. Forum Categories, Questions, Answers, Votes & Reports
create table if not exists public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  active boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_forum_categories_club on public.forum_categories(club_id);

create table if not exists public.forum_questions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.forum_categories(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title text not null check (char_length(title) <= 200),
  content text not null check (char_length(content) <= 10000),
  anonymous boolean default false,
  pinned boolean default false,
  locked boolean default false,
  removed boolean default false,
  votes integer default 0,
  answer_count integer default 0,
  accepted_answer_id uuid,
  created_at timestamptz default now()
);
create index if not exists idx_forum_questions_club on public.forum_questions(club_id);

create table if not exists public.forum_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.forum_questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.forum_answers(id) on delete cascade,
  content text not null check (char_length(content) <= 10000),
  anonymous boolean default false,
  removed boolean default false,
  votes integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_forum_answers_question on public.forum_answers(question_id);

create table if not exists public.forum_votes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.forum_questions(id) on delete cascade,
  answer_id uuid references public.forum_answers(id) on delete cascade,
  created_at timestamptz default now(),
  check (
    (question_id is not null and answer_id is null) or
    (question_id is null and answer_id is not null)
  )
);
create unique index if not exists idx_forum_votes_question on public.forum_votes(profile_id, question_id) where question_id is not null;
create unique index if not exists idx_forum_votes_answer on public.forum_votes(profile_id, answer_id) where answer_id is not null;

create table if not exists public.forum_reports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.forum_questions(id) on delete cascade,
  answer_id uuid references public.forum_answers(id) on delete cascade,
  reason text not null check (char_length(reason) <= 1000),
  resolved boolean default false,
  created_at timestamptz default now()
);

-- 14. Action Commitments & Accountability
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title text not null check (char_length(title) <= 160),
  description text default '',
  target_date date not null,
  status text not null check (status in ('pending', 'completed', 'not_completed')) default 'pending',
  outcome text default '',
  shared boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_commitments_profile on public.commitments(profile_id);

create table if not exists public.accountability_partners (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  first_id uuid not null references public.profiles(id) on delete cascade,
  second_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.encouragements (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) <= 280),
  created_at timestamptz default now()
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week text not null,
  achieved boolean default false,
  lesson text default '',
  improvement text default '',
  created_at timestamptz default now(),
  unique (profile_id, week)
);

-- 15. Challenges & Participation
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (char_length(title) <= 160),
  description text default '',
  start_date date not null,
  end_date date not null,
  goal_type text not null check (goal_type in ('minutes', 'days', 'insights', 'commitments')),
  target integer not null check (target between 1 and 10000),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz,
  joined_at timestamptz default now(),
  unique (challenge_id, profile_id)
);

-- 16. Book Voting Rounds & Nominations
create table if not exists public.voting_rounds (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (char_length(title) <= 160),
  deadline timestamptz not null,
  status text not null check (status in ('open', 'closed')) default 'open',
  winner_id uuid references public.books(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.book_nominations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.voting_rounds(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  votes integer default 0,
  unique (round_id, book_id)
);

create table if not exists public.book_votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.voting_rounds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nomination_id uuid not null references public.book_nominations(id) on delete cascade,
  created_at timestamptz default now(),
  unique (round_id, profile_id)
);

-- 17. Meetings & RSVPs
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (char_length(title) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  location text not null check (char_length(location) <= 500),
  description text default '',
  book_id uuid references public.books(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.meeting_rsvps (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'declined')),
  question text default '',
  created_at timestamptz default now(),
  unique (meeting_id, profile_id)
);

create table if not exists public.book_reviews (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  lessons text[] not null default '{}',
  applied text not null,
  changed text not null,
  improvement text not null,
  created_at timestamptz default now(),
  unique (meeting_id, profile_id)
);

-- 18. Notifications & Club Counters
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  href text not null default '/home',
  read boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_profile on public.notifications(profile_id, read);

create table if not exists public.counters (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  members integer default 0,
  insights integer default 0,
  questions integer default 0,
  sessions integer default 0
);


-- All data access goes through scoped RPCs. Raw author identities and private
-- reading data are deliberately unavailable through the REST table API.
create schema if not exists private;
revoke all on schema private from public;
alter table public.invitations alter column created_by drop not null;
alter table public.invitations add column bootstrap boolean not null default false;
create unique index memberships_one_club on public.memberships(profile_id);
alter table public.reading_logs add check (start_page >= 0);
alter table public.challenges add check (end_date >= start_date);
alter table public.accountability_partners add check (first_id <> second_id);
create table public.club_revisions (club_id uuid primary key references public.clubs(id), revision bigint not null default 0);
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t.tablename);
 execute format('revoke all on public.%I from anon, authenticated',t.tablename);
 end loop;
end $$;
create function private.member_club() returns uuid language sql stable security definer set search_path='' as $$
 select club_id from public.memberships where profile_id=auth.uid() and status='active'
$$;
grant usage on schema private to authenticated;
grant execute on function private.member_club() to authenticated;
create policy member_revision on public.club_revisions for select to authenticated using (club_id=(select private.member_club()));
grant select on public.club_revisions to authenticated;
alter publication supabase_realtime add table public.club_revisions;

create function private.dto(j jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; outj jsonb='{}'; nk text; part text; begin
 if j is null then return null; end if;
 for k,v in select * from jsonb_each(j) loop
 if v='null'::jsonb then continue; end if;
 nk=split_part(k,'_',1);
 foreach part in array (string_to_array(k,'_'))[2:] loop nk=nk||initcap(part); end loop;
 if k='id' then nk='_id'; end if;
 if k in ('created_at','joined_at','last_active_at','completed_at','updated_at','expires_at','starts_at','ends_at','deadline') then
 v=to_jsonb(extract(epoch from (v#>>'{}')::timestamptz)*1000);
 end if;
 outj=outj||jsonb_build_object(nk,v);
 if k='created_at' then outj=outj||jsonb_build_object('_creationTime',v); end if;
 end loop;
 return outj;
end $$;
create function private.author(p uuid, anonymous boolean default false) returns jsonb language sql stable set search_path='' as $$
 select case when anonymous then jsonb_build_object('name','Anonymous member','avatarUrl',null)
 else (select jsonb_build_object('name',name,'avatarUrl',avatar_url) from public.profiles where id=p) end
$$;
create function private.question(q public.forum_questions, u uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',q.id,'createdAt',extract(epoch from q.created_at)*1000,'title',q.title,'content',q.content,
 'categoryId',q.category_id,'category',(select name from public.forum_categories where id=q.category_id),
 'bookTitle',(select title from public.books where id=q.book_id),'anonymous',q.anonymous,'author',private.author(q.author_id,q.anonymous),
 'isMine',q.author_id=u,'pinned',q.pinned,'locked',q.locked,'votes',(select count(*) from public.forum_votes where question_id=q.id),
 'answerCount',(select count(*) from public.forum_answers where question_id=q.id and not removed),'acceptedAnswerId',q.accepted_answer_id,
 'myVote',exists(select 1 from public.forum_votes where question_id=q.id and profile_id=u))
$$;
create function private.totals(u uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('profileId',u,'minutes',coalesce(sum(minutes),0),'pages',coalesce(sum(pages),0),'days',count(distinct date),'sessions',count(*),
 'books',(select count(*) from public.user_books where profile_id=u and status='completed')) from public.reading_logs where profile_id=u
$$;
create function private.page(items jsonb, n integer, offst integer) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('page',coalesce((select jsonb_agg(value) from jsonb_array_elements(items) with ordinality where ordinality<=n),'[]'),
 'isDone',jsonb_array_length(items)<=n,'continueCursor',(offst+n)::text)
$$;
create function private.notify(p uuid,t text,b text,h text) returns void language sql set search_path='' as $$
 insert into public.notifications(profile_id,title,body,href) select p,t,b,h where exists(select 1 from public.profiles where id=p and notifications_enabled)
$$;
create function private.signup() returns trigger language plpgsql security definer set search_path='' as $$
declare inv public.invitations; code text=upper(trim(new.raw_user_meta_data->>'invite_code')); begin
 select * into inv from public.invitations where code_hash=encode(extensions.digest(code,'sha256'),'hex') for update;
 if inv.id is null or inv.revoked or inv.expires_at<=now() or inv.uses>=inv.max_uses then raise exception 'A valid invitation is required'; end if;
 if nullif(trim(new.raw_user_meta_data->>'name'),'') is null then raise exception 'Name is required'; end if;
 if not exists(select 1 from pg_timezone_names where name=coalesce(new.raw_user_meta_data->>'timezone','UTC')) then raise exception 'Invalid timezone'; end if;
 insert into public.profiles(id,name,email,timezone) values(new.id,trim(new.raw_user_meta_data->>'name'),new.email,coalesce(new.raw_user_meta_data->>'timezone','UTC'));
 insert into public.memberships(club_id,profile_id,role,status) values(inv.club_id,new.id,case when inv.bootstrap then 'admin' else 'member' end,'active');
 insert into public.reading_goals(profile_id) values(new.id);
 update public.invitations set uses=uses+1 where id=inv.id;
 insert into public.invitation_redemptions(invitation_id,profile_id) values(inv.id,new.id);
 update auth.users set raw_user_meta_data=raw_user_meta_data-'invite_code' where id=new.id;
 update public.club_revisions set revision=revision+1 where club_id=inv.club_id;
 return new;
end $$;
create trigger bookcircle_signup after insert on auth.users for each row execute function private.signup();
create function public.validate_invitation(code text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('clubName',c.name) from public.invitations i join public.clubs c on c.id=i.club_id
 where i.code_hash=encode(extensions.digest(upper(trim(code)),'sha256'),'hex') and not i.revoked and i.expires_at>now() and i.uses<i.max_uses
$$;
revoke all on function public.validate_invitation(text) from public;
grant execute on function public.validate_invitation(text) to anon,authenticated;

create function private.query(operation text,args jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
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
 when 'reading.reflections' then select private.page(coalesce(jsonb_agg(private.dto(to_jsonb(t))),'[]'),n,o) into j from (select * from reflections where profile_id=u order by created_at desc,id limit n+1 offset o)t;
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
create function private.challenge_progress(ch public.challenges,u uuid) returns integer language sql stable set search_path='' as $$
 select case ch.goal_type
 when 'minutes' then (select coalesce(sum(minutes),0)::int from public.reading_logs where profile_id=u and date between ch.start_date and ch.end_date)
 when 'days' then (select count(distinct date)::int from public.reading_logs where profile_id=u and date between ch.start_date and ch.end_date)
 when 'insights' then (select count(*)::int from public.insights where author_id=u and (created_at at time zone (select timezone from public.profiles where id=u))::date between ch.start_date and ch.end_date)
 when 'commitments' then (select count(*)::int from public.commitments where profile_id=u and status='completed' and (completed_at at time zone (select timezone from public.profiles where id=u))::date between ch.start_date and ch.end_date) end
$$;
create function private.winner(r uuid) returns uuid language sql stable set search_path='' as $$
 select n.book_id from public.book_nominations n left join public.book_votes v on v.nomination_id=n.id where n.round_id=r group by n.id order by count(v.id) desc,n.id limit 1
$$;
create function private.mutate(operation text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid(); c uuid; adm boolean; x uuid=nullif(args->>'id','')::uuid; b uuid=nullif(args->>'bookId','')::uuid; q uuid=nullif(args->>'questionId','')::uuid; a uuid=nullif(args->>'answerId','')::uuid; t uuid; p uuid; rr record; result jsonb='null'; code text; d date; begin
 select club_id,role='admin' into c,adm from memberships where profile_id=u and status='active';
 if c is null then raise exception 'Active membership required' using errcode='42501'; end if;
 -- Serializes related writes, including votes, pairing and rate limits.
 perform pg_advisory_xact_lock(hashtextextended(c::text,0));
 if octet_length(args::text)>40000 then raise exception 'Request too large'; end if;
 if operation like 'admin.%' or operation in('reading.addBook','reading.editBook','reading.deleteBook','club.pairMembers','club.saveChallenge','club.deleteChallenge','club.saveVotingRound','club.nominate','club.closeVoting','club.saveMeeting','forum.moderate') then
 if not adm then raise exception 'Administrator access required' using errcode='42501'; end if; end if;
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
 else update insights set title=trim(args->>'title'),content=trim(args->>'content'),chapter=args->>'chapter',book_id=b where id=x and club_id=c and author_id=u; if not found then raise exception 'Insight not found or not yours'; end if; end if;
 when 'community.remove' then delete from insights where id=x and club_id=c and (author_id=u or adm); if not found then raise exception 'Insight not found or permission denied'; end if;
 when 'community.comment','community.react' then
 select author_id into p from insights where id=x and club_id=c; if p is null then raise exception 'Insight not found'; end if;
 if operation='community.comment' then
 if length(trim(args->>'content'))<1 then raise exception 'Comment is required'; end if;
 insert into insight_comments(insight_id,author_id,content) values(x,u,trim(args->>'content')) returning id into t; result=to_jsonb(t);
 if p<>u then perform private.notify(p,'New comment','Someone replied to your insight.','/community'); end if;
 else delete from insight_reactions where insight_id=x and profile_id=u and type=args->>'type'; if not found then insert into insight_reactions(insight_id,profile_id,type) values(x,u,args->>'type'); end if; end if;
 when 'community.removeComment' then delete from insight_comments ic using insights i where ic.id=x and i.id=ic.insight_id and i.club_id=c and (ic.author_id=u or adm); if not found then raise exception 'Comment not found or permission denied'; end if;
 when 'forum.ask' then
 if not exists(select 1 from forum_categories where id=(args->>'categoryId')::uuid and club_id=c and active) then raise exception 'Choose an active category'; end if;
 if length(trim(args->>'title'))<1 or length(trim(args->>'content'))<1 then raise exception 'Title and content are required'; end if;
 insert into forum_questions(club_id,author_id,category_id,book_id,title,content,anonymous) values(c,u,(args->>'categoryId')::uuid,b,trim(args->>'title'),trim(args->>'content'),(args->>'anonymous')::boolean) returning id into x; result=to_jsonb(x);
 when 'forum.updateQuestion' then update forum_questions set title=trim(args->>'title'),content=trim(args->>'content') where id=x and club_id=c and author_id=u and not removed and not locked; if not found then raise exception 'Question unavailable or locked'; end if;
 when 'forum.removeQuestion' then update forum_questions set removed=true where id=x and club_id=c and (author_id=u or adm); if not found then raise exception 'Question not found or permission denied'; end if;
 when 'forum.answer' then
 select * into rr from forum_questions where id=q and club_id=c and not locked and not removed; if rr.id is null then raise exception 'Question unavailable or locked'; end if;
 if args ? 'parentId' and not exists(select 1 from forum_answers where id=(args->>'parentId')::uuid and question_id=q and not removed and parent_id is null) then raise exception 'Replies support one nested level'; end if;
 if length(trim(args->>'content'))<1 then raise exception 'Answer is required'; end if;
 insert into forum_answers(question_id,author_id,parent_id,content,anonymous) values(q,u,(args->>'parentId')::uuid,trim(args->>'content'),(args->>'anonymous')::boolean) returning id into x; result=to_jsonb(x);
 if rr.author_id<>u then perform private.notify(rr.author_id,'New answer','Someone answered your question.','/forum/'||q); end if;
 when 'forum.updateAnswer','forum.removeAnswer' then
 select fq.id into q from forum_answers fa join forum_questions fq on fq.id=fa.question_id where fa.id=x and fq.club_id=c and (fa.author_id=u or (adm and operation='forum.removeAnswer')) and not fq.removed and (not fq.locked or operation='forum.removeAnswer');
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
 if x is null then insert into challenges(club_id,title,description,start_date,end_date,goal_type,target,created_by) values(c,args->>'title',args->>'description',(args->>'startDate')::date,(args->>'endDate')::date,args->>'goalType',(args->>'target')::int,u) returning id into x;
 else update challenges set title=args->>'title',description=args->>'description',start_date=(args->>'startDate')::date,end_date=(args->>'endDate')::date,goal_type=args->>'goalType',target=(args->>'target')::int where id=x and club_id=c; if not found then raise exception 'Challenge not found'; end if; end if; result=to_jsonb(x);
 when 'club.deleteChallenge' then delete from challenges where id=x and club_id=c;
 when 'club.joinChallenge' then
 if not exists(select 1 from challenges where id=x and club_id=c and end_date>=(now() at time zone (select timezone from profiles where id=u))::date) then raise exception 'Challenge unavailable'; end if;
 insert into challenge_participants(challenge_id,profile_id) values(x,u) on conflict do nothing;
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

create function public.bookcircle_query(operation text,args jsonb default '{}') returns jsonb language sql stable security invoker set search_path='' as $$ select private.query(operation,args) $$;
create function public.bookcircle_mutate(operation text,args jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.mutate(operation,args) $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.query(text,jsonb),private.mutate(text,jsonb),private.member_club() to authenticated;
revoke all on function public.bookcircle_query(text,jsonb),public.bookcircle_mutate(text,jsonb) from public,anon;
grant execute on function public.bookcircle_query(text,jsonb),public.bookcircle_mutate(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy avatar_insert on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.member_club()) is not null);
create policy avatar_read on storage.objects for select to authenticated using (bucket_id='avatars' and (select private.member_club()) is not null and exists(select 1 from public.club_revisions where club_id=(select private.member_club())));
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and owner_id=(select auth.uid())::text);

-- One club, real empty member data. Library entries are starter catalogue items.
with c as(insert into public.clubs(name,description,weekly_prompt) values('BookCircle','Read with purpose. Grow together.','What is one idea from your reading that you will put into practice this week?') returning id)
insert into public.club_revisions(club_id) select id from c;
insert into public.forum_categories(club_id,name) select c.id,n from public.clubs c cross join unnest(array['Book discussions','Personal growth','Putting ideas into practice','Questions & support'])n;
insert into public.books(club_id,title,author,total_pages,category,description,cover_url) select c.id,b.* from public.clubs c cross join(values
 ('Atomic Habits','James Clear',320,'Personal Growth','Small changes, remarkable results.','https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg'),
 ('Deep Work','Cal Newport',304,'Productivity','Rules for focused success in a distracted world.','https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg'),
 ('The Psychology of Money','Morgan Housel',256,'Finance','Timeless lessons on wealth, greed, and happiness.','https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg')
)b(title,author,total_pages,category,description,cover_url);
