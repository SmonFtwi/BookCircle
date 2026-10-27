import { QuestionPage } from "@/components/bookcircle/forum";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QuestionPage id={id} />;
}
