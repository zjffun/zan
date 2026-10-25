import { redirect } from "next/navigation";

/** There is only one thing to make from the top bar now: a post. Old links to /new end up there. */
export default function NewPage(): never {
  redirect("/new/post");
}
