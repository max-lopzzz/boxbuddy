import Image from "next/image";

const ILLUSTRATIONS = {
  greet: { src: "/illustrations/greet.png", alt: "A cat peeking around the corner" },
  "no-results": { src: "/illustrations/no-results.png", alt: "A sad cat sitting in an empty box" },
  loading: { src: "/illustrations/loading.png", alt: "A cat carrying a box" },
} as const;

export function EmptyState({
  illustration,
  title,
  subtitle,
  action,
}: {
  illustration: keyof typeof ILLUSTRATIONS;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { src, alt } = ILLUSTRATIONS[illustration];
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <Image src={src} alt={alt} width={200} height={200} />
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      {action}
    </div>
  );
}
