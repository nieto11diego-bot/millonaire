import { redirect } from "next/navigation";

/** Serve the canvas game directly (iframe broke map init on Vercel). */
export default function PlayPage() {
  redirect("/game/index.html");
}
