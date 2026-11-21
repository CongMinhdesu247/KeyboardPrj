"use client";
import { useId, useState, type ReactNode } from "react";
export function AdminTabs({
  panels,
  initial,
}: {
  panels: { id: string; label: string; content: ReactNode }[];
  initial: string;
}) {
  const [active, setActive] = useState(initial),
    prefix = useId();
  return (
    <div className="admin-tab-view">
      <div className="admin-tabs" role="tablist" aria-label="Nội dung đơn hàng">
        {panels.map((p, index) => (
          <button
            key={p.id}
            id={`${prefix}-${p.id}`}
            type="button"
            role="tab"
            aria-selected={active === p.id}
            aria-controls={`${prefix}-${p.id}-panel`}
            tabIndex={active === p.id ? 0 : -1}
            onClick={() => setActive(p.id)}
            onKeyDown={(e) => {
              let next: number | undefined;
              if (e.key === "ArrowRight") next = (index + 1) % panels.length;
              if (e.key === "ArrowLeft")
                next = (index + panels.length - 1) % panels.length;
              if (e.key === "Home") next = 0;
              if (e.key === "End") next = panels.length - 1;
              if (next !== undefined) {
                e.preventDefault();
                setActive(panels[next].id);
                e.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next]?.focus();
              }
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {panels.map((p) => (
        <div
          key={p.id}
          id={`${prefix}-${p.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${prefix}-${p.id}`}
          hidden={active !== p.id}
          tabIndex={0}
        >
          {p.content}
        </div>
      ))}
    </div>
  );
}
