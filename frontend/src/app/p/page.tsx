import { permanentRedirect } from "next/navigation";

export default function PrivatePollIndexPage() {
  permanentRedirect("/");
}
