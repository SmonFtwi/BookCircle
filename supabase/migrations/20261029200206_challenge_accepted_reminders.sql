-- Only accepted participants can complete a challenge in the hourly job.
create or replace function private.scheduled_work() returns void language plpgsql security definer set search_path='' as $$
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
 update public.challenge_participants cp set completed_at=now() from public.challenges ch where ch.id=cp.challenge_id and cp.status='accepted' and cp.completed_at is null and private.challenge_progress(ch,cp.profile_id)>=ch.target;
 update public.club_revisions set revision=revision+1;
end $$;
revoke all on function private.scheduled_work() from public,anon,authenticated;
