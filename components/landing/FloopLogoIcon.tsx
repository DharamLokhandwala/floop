"use client";

interface FloopLogoIconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" };
const dotSizeMap = { sm: "w-1 h-1", md: "w-1.5 h-1.5", lg: "w-2 h-2" };

export function FloopLogoIcon({ className = "", size = "md" }: FloopLogoIconProps) {
  return (
    <div
      className={`${sizeMap[size]} grid grid-cols-4 grid-rows-2 gap-0.5 ${className}`}
      aria-hidden
    >
      <div className={`${dotSizeMap[size]} rounded-full bg-foreground/90`} />
      <div className={`${dotSizeMap[size]} rounded-full bg-foreground/90`} />
      <div className={`${dotSizeMap[size]} rounded-full bg-foreground/90`} />
      <div className={`${dotSizeMap[size]} rounded-full bg-foreground/90`} />
      <div className={`${dotSizeMap[size]} rounded-full bg-foreground/90`} />
      <div className={`${dotSizeMap[size]} rounded-full bg-foreground/90`} />
      <div className={`${dotSizeMap[size]} rounded-full bg-primary`} />
      <div className={`${dotSizeMap[size]} rounded-full bg-primary`} />
    </div>
  );
}
