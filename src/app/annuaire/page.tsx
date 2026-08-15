import { permanentRedirect } from "next/navigation";

// L'annuaire et les membres montraient les mêmes personnes. Un 308 plutôt
// qu'une suppression : le lien a pu être partagé dans une conversation.
export default function AnnuairePage(): never {
  permanentRedirect("/membres");
}
