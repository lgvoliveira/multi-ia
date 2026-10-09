"use client";

// Prévia do site feito pelas IAs, dentro de uma moldura isolada (o "quarto trancado").
// O site roda de verdade, com o JavaScript "de enfeite", mas não enxerga nada fora da moldura.
// As outras camadas de proteção estão explicadas em generated-site.ts.

import { useMemo } from "react";
import { buildPreviewDocument } from "./generated-site";
import styles from "./SitePreview.module.css";

/**
 * SÓ "allow-scripts". Nunca acrescente "allow-same-origin": com ele, o código do site passaria a enxergar
 * a nossa página, o login e os créditos. Também ficam de fora formulários, janelas novas e downloads.
 */
const SANDBOX = "allow-scripts";

export function SitePreview({ html }: { html: string }) {
  const previewDocument = useMemo(() => buildPreviewDocument(html), [html]);

  return (
    <div className={styles.window}>
      {/* Só enfeite: a barra de cima de uma janela de navegador. */}
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      <iframe
        className={styles.frame}
        title="Prévia do site"
        sandbox={SANDBOX}
        srcDoc={previewDocument}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
