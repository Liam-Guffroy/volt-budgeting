import { Card } from "@/components/ui/card";

/** Small building blocks shared by the statistics and year pages. */

export function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Stat tile: label, value (proportional figures — it stands alone), a note. */
export function Tile({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold" title={value}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{children}</p>
    </Card>
  );
}
