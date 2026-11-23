import { BookDetail } from "@/components/bookcircle/book-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <BookDetail id={(await params).id} />;
}
