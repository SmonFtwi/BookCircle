import Welcome from "@/components/bookcircle/welcome";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return <Welcome invite={invite} />;
}
