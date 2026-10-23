const RULES = [
  "Tickets flood in. Each one needs a stamp: 💬 Support, 💳 Billing, or ⚙️ Ops.",
  "Your stamp is your job. Clear your tickets; route everyone else's to ping the right person and buy time.",
  "Burned timers hurt Company Health. Survive 5 minutes with the company alive.",
];

export function RulesCard({ className = "" }: { className?: string }) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg tracking-tight">How the shift works</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-soft">
          Three rules
        </span>
      </div>
      <ol className="mt-3 space-y-3">
        {RULES.map((rule, index) => (
          <li key={index} className="flex gap-3">
            <span className="mt-[1px] grid size-6 shrink-0 place-items-center rounded-full border border-ink/30 font-mono text-[11px] font-bold">
              {index + 1}
            </span>
            <p className="text-[13px] leading-relaxed text-ink/90">{rule}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
