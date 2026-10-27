create table public.forum_reactions (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 question_id uuid references public.forum_questions(id) on delete cascade,
 answer_id uuid references public.forum_answers(id) on delete cascade,
 emoji text not null check (emoji in ('👍','❤️','😂','💡','👏','🤔')),
 created_at timestamptz not null default now(),
 check (num_nonnulls(question_id,answer_id)=1),
 unique nulls not distinct(profile_id,question_id,answer_id,emoji)
);
create index forum_reactions_question on public.forum_reactions(question_id);
create index forum_reactions_answer on public.forum_reactions(answer_id);
alter table public.forum_reactions enable row level security;
revoke all on public.forum_reactions from anon,authenticated;
create policy rpc_only on public.forum_reactions for all to anon,authenticated using(false) with check(false);

create function private.reaction_club(q uuid,a uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare c uuid=private.member_club();begin
 if c is null then raise exception 'Active membership required' using errcode='42501';end if;
 if num_nonnulls(q,a)<>1 then raise exception 'Choose one reaction target';end if;
 if q is not null then
 if not exists(select 1 from public.forum_questions where id=q and club_id=c and not removed) then raise exception 'Question not found';end if;
 else
 if not exists(select 1 from public.forum_answers fa join public.forum_questions fq on fq.id=fa.question_id where fa.id=a and fq.club_id=c and not fa.removed and not fq.removed) then raise exception 'Answer not found';end if;
 end if;
 return c;
end $$;
create function private.forum_reactions(q uuid,a uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform private.reaction_club(q,a);
 select coalesce(jsonb_agg(jsonb_build_object('emoji',r.emoji,'count',r.count,'mine',r.mine) order by r.emoji),'[]') into result
 from(select emoji,count(*) as count,bool_or(profile_id=auth.uid()) as mine from public.forum_reactions where question_id=q or answer_id=a group by emoji)r;
 return result;
end $$;
create function private.toggle_forum_reaction(e text,q uuid,a uuid) returns void language plpgsql security definer set search_path='' as $$
declare c uuid;begin
 perform private.allow_write();
 c=private.reaction_club(q,a);
 if e is null or e not in('👍','❤️','😂','💡','👏','🤔') then raise exception 'Unsupported reaction';end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text,0));
 delete from public.forum_reactions where profile_id=auth.uid() and emoji=e and (question_id=q or answer_id=a);
 if not found then insert into public.forum_reactions(profile_id,question_id,answer_id,emoji) values(auth.uid(),q,a,e);end if;
 update public.club_revisions set revision=revision+1 where club_id=c;
end $$;
create function public.forum_reactions(question_id uuid default null,answer_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.forum_reactions(question_id,answer_id)$$;
create function public.toggle_forum_reaction(emoji text,question_id uuid default null,answer_id uuid default null) returns void language sql security invoker set search_path='' as $$select private.toggle_forum_reaction(emoji,question_id,answer_id)$$;
revoke all on function private.reaction_club(uuid,uuid),private.forum_reactions(uuid,uuid),private.toggle_forum_reaction(text,uuid,uuid),public.forum_reactions(uuid,uuid),public.toggle_forum_reaction(text,uuid,uuid) from public,anon,authenticated;
grant execute on function private.forum_reactions(uuid,uuid),private.toggle_forum_reaction(text,uuid,uuid),public.forum_reactions(uuid,uuid),public.toggle_forum_reaction(text,uuid,uuid) to authenticated;
