import { notFound } from "next/navigation";

// Always a 404, so there's no shell for instant navigation to validate.
export const instant = false;

/** Any other URL: the 404 page, inside the layout so it keeps the language and theme. */
export default function MissingPage() {
  notFound();
}
