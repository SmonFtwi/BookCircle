import Welcome from "@/components/bookcircle/welcome";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; authError?: string }>;
}) {
  const { invite, authError } = await searchParams;
  return <Welcome invite={invite} authError={authError} />;
}
