import { permanentRedirect } from "next/navigation";

export default function DraftsIndexPage() {
  permanentRedirect("/drafts/new");
}
