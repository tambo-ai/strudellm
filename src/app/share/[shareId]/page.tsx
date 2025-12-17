import { getSongShare } from "@/services/song-share";
import { notFound } from "next/navigation";
import { SharedSongClient } from "./shared-song-client";

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const share = await getSongShare(shareId);

  if (!share) {
    notFound();
  }

  return <SharedSongClient code={share.code} title={share.title ?? "Shared song"} />;
}
