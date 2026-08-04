import { cn } from "../lib/utils";

const base =
  "pointer-events-none absolute size-2 border-phosphor/35 transition-colors duration-200 group-hover:border-phosphor";

/** The four “targeting” corner brackets on every card. */
export default function CornerBrackets() {
  return (
    <>
      <span aria-hidden className={cn(base, "left-[-1px] top-[-1px] border-l border-t")} />
      <span aria-hidden className={cn(base, "right-[-1px] top-[-1px] border-r border-t")} />
      <span aria-hidden className={cn(base, "bottom-[-1px] left-[-1px] border-b border-l")} />
      <span aria-hidden className={cn(base, "bottom-[-1px] right-[-1px] border-b border-r")} />
    </>
  );
}
