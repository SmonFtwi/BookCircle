-- Broadcast only in-app notifications to active, opted-in club members.
create function private.activity_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='challenges' then
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
revoke all on function private.activity_notification() from public,anon,authenticated;
create trigger challenge_notification after insert on public.challenges for each row execute function private.activity_notification();
create trigger prompt_notification after update of weekly_prompt on public.clubs for each row execute function private.activity_notification();
