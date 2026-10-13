import { redirect } from "next/navigation";

export default function MedicationsPage() {
  redirect("/patients?tab=medications");
}
