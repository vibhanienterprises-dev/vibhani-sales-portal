type ScoredLead = {
  stage: string;
  dealValue?: string | number | null;
  gstin?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  state?: string | null;
  industry?: string | null;
};

export type ScoreBreakdown = {
  total: number;
  stage: number;
  dealValue: number;
  gstin: number;
  contact: number;
  profile: number;
  label: "cold" | "warm" | "hot";
};

export function scoreLead(lead: ScoredLead): ScoreBreakdown {
  let stage = 0;
  switch (lead.stage) {
    case "new":            stage = 5;  break;
    case "contacted":      stage = 15; break;
    case "quotation_sent": stage = 25; break;
    case "converted":      stage = 10; break;
    case "lost":           stage = 0;  break;
  }

  let dealValue = 0;
  const val = parseFloat(String(lead.dealValue ?? "0")) || 0;
  if (val >= 1_000_000)    dealValue = 30;
  else if (val >= 500_000) dealValue = 25;
  else if (val >= 100_000) dealValue = 20;
  else if (val >= 50_000)  dealValue = 14;
  else if (val >= 10_000)  dealValue = 8;
  else if (val > 0)        dealValue = 3;

  const gstin = lead.gstin ? 15 : 0;

  let contact = 0;
  if (lead.contactName) contact += 6;
  if (lead.email)       contact += 7;
  if (lead.phone)       contact += 7;

  let profile = 0;
  if (lead.notes)      profile += 3;
  if (lead.assignedTo) profile += 4;
  if (lead.state)      profile += 2;
  if (lead.industry)   profile += 3;

  const total = Math.min(100, stage + dealValue + gstin + contact + profile);
  const label: ScoreBreakdown["label"] =
    total >= 61 ? "hot" : total >= 31 ? "warm" : "cold";

  return { total, stage, dealValue, gstin, contact, profile, label };
}

export function getScoreColor(label: ScoreBreakdown["label"]) {
  switch (label) {
    case "hot":  return { badge: "bg-green-500/20 text-green-400 border-green-500/30", bar: "bg-green-500", icon: "🔥" };
    case "warm": return { badge: "bg-amber-500/20 text-amber-400 border-amber-500/30", bar: "bg-amber-500", icon: "⚡" };
    case "cold": return { badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",  bar: "bg-blue-400",  icon: "❄️" };
  }
}
