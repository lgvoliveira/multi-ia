// O texto final de uma receita, com o título, as seções, as listas e os destaques que a IA marcou
// (lib/ock/rich-text.ts). Tudo entra na página como texto: nada do que a IA escreveu vira código aqui.

import type { ReactNode } from "react";
import { parseRichText, type TextBlock, type TextSpan } from "@/lib/ock/rich-text";
import styles from "./RichText.module.css";

interface RichTextProps {
  text: string;
}

export function RichText({ text }: RichTextProps) {
  return <div className={styles.text}>{groupItems(parseRichText(text)).map(renderGroup)}</div>;
}

/** Itens de lista seguidos viram uma lista só. */
type Group = TextBlock | { kind: "list"; items: TextBlock[] };

function groupItems(blocks: TextBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    const last = groups.at(-1);
    if (block.kind !== "item") groups.push(block);
    else if (last?.kind === "list") last.items.push(block);
    else groups.push({ kind: "list", items: [block] });
  }
  return groups;
}

function renderGroup(group: Group, index: number): ReactNode {
  switch (group.kind) {
    case "list":
      return (
        <ul key={index} className={styles.list}>
          {group.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderSpans(item.spans)}</li>
          ))}
        </ul>
      );
    // A página já tem o título da tela (h2); o título do texto vem logo abaixo.
    case "title":
      return (
        <h3 key={index} className={styles.title}>
          {renderSpans(group.spans)}
        </h3>
      );
    case "heading":
      return (
        <h4 key={index} className={styles.heading}>
          {renderSpans(group.spans)}
        </h4>
      );
    default:
      return (
        <p key={index} className={styles.paragraph}>
          {renderSpans(group.spans)}
        </p>
      );
  }
}

function renderSpans(spans: TextSpan[]): ReactNode {
  return spans.map((span, index) => (span.bold ? <strong key={index}>{span.text}</strong> : span.text));
}
