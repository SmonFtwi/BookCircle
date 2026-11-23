import { ClubScreen } from "@/components/bookcircle/tab-screens";
export default async function Page({params}: {params: Promise<{section: string}>}) {
  return <ClubScreen section={(await params).section} />;
}
