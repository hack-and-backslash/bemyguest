import { permanentRedirect } from "next/navigation";

/** The gallery became the Photo Booth. */
export default function GalleryPage() {
  permanentRedirect("/booth");
}
