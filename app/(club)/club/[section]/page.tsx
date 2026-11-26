import { redirect } from "next/navigation";
import { ClubScreen } from "@/components/bookcircle/tab-screens";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["discuss", "vote", "meetings"].includes(section))
    redirect("/club/discuss");
  return <ClubScreen section={section} />;
}
