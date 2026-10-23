import type { Stamp } from "@/convex/gameTypes";

type StampMeta = {
  label: string;
  icon: string;
  text: string;
  bg: string;
  border: string;
  dot: string;
};

export const STAMP_META: Record<Stamp, StampMeta> = {
  support: {
    label: "Support",
    icon: "💬",
    text: "text-support",
    bg: "bg-support/10",
    border: "border-support/50",
    dot: "bg-support",
  },
  billing: {
    label: "Billing",
    icon: "💳",
    text: "text-billing",
    bg: "bg-billing/10",
    border: "border-billing/50",
    dot: "bg-billing",
  },
  ops: {
    label: "Ops",
    icon: "⚙️",
    text: "text-ops",
    bg: "bg-ops/10",
    border: "border-ops/50",
    dot: "bg-ops",
  },
};
