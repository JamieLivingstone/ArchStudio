import type { AnchorHTMLAttributes } from "react";
import { isDesktop } from "../../tauri/providers";
import { openLink } from "../../tauri/window";

// The desktop webview does not open a new-tab link in the system browser.
export function Link({ href, ...anchor }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      {...anchor}
      onClick={(event) => {
        if (!isDesktop()) return;
        event.preventDefault();
        openLink(href);
      }}
    />
  );
}
