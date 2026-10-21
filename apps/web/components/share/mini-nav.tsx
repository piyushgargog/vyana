export interface ShareSectionLink {
  id: string;
  label: string;
}

/**
 * The sticky mini-nav of the share page (issue #238): jumps to the sections this
 * record actually has. Hidden in print, where the paper order is the page order.
 */
export function ShareMiniNav({ sections }: { sections: ShareSectionLink[] }) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label="Record sections" className="sticky top-2 z-10 print:hidden">
      <ul className="glass-bar flex gap-1 overflow-x-auto rounded-full border border-separator px-2 py-1.5 shadow-glass">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="block whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold text-label-2 transition-colors hover:bg-accent-soft hover:text-accent-strong motion-reduce:transition-none"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
