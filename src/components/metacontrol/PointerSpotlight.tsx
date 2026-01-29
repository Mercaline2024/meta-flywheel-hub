import * as React from "react";

type PointerSpotlightProps = {
  className?: string;
  children: React.ReactNode;
};

/**
 * Signature moment: un "spotlight" sutil que sigue el puntero.
 * Respeta reduced motion y no depende de colores hardcodeados.
 */
export default function PointerSpotlight({ className, children }: PointerSpotlightProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      el.style.setProperty("--mc-x", `${x}px`);
      el.style.setProperty("--mc-y", `${y}px`);
    };

    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      className={[
        "relative",
        // background spotlight (token-driven)
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-100",
        "before:bg-[radial-gradient(700px_circle_at_var(--mc-x,50%)_var(--mc-y,20%),hsl(var(--primary)/0.14),transparent_55%)]",
        "before:transition-opacity before:duration-300",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
