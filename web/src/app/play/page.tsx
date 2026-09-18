import { redirect } from "next/navigation";

type PlaySearch = { mode?: string };

/** Serve the canvas game directly (iframe broke map init on Vercel). */
export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<PlaySearch>;
}) {
  const sp = await searchParams;
  if (sp.mode === "guest") {
    redirect("/game/index.html?mode=guest");
  }
  redirect("/game/index.html");
}
