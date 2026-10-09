import type { ProviderId } from "@/lib/providers/types";
import styles from "./AiDot.module.css";

interface AiDotProps {
  provider: ProviderId;
  size?: "small" | "large";
}

// Bolinha com a cor da IA. É só enfeite: o nome da IA sempre aparece escrito ao lado.
export function AiDot({ provider, size = "small" }: AiDotProps) {
  const className = [styles.dot, styles[provider], size === "large" && styles.large]
    .filter(Boolean)
    .join(" ");

  return <span className={className} aria-hidden="true" />;
}
