import Markdown, { type Components } from "react-markdown";

const allowed = [
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

const list = "my-1.5 first:mt-0 last:mb-0 [&_ol]:my-0.5 [&_ul]:my-0.5 [&_ul]:list-[circle]";

const heading: Components["h1"] = ({ children }) => <p className="my-2 font-semibold first:mt-0">{children}</p>;

const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className={`${list} list-disc pl-4`}>{children}</ul>,
  ol: ({ children, start }) => (
    <ol start={start} className={`${list} list-decimal pl-5`}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => <code className="rounded bg-line px-1 py-px font-mono text-xs">{children}</code>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-line p-2 font-mono text-xs [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-line pl-2 text-muted">{children}</blockquote>
  ),
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
};

export function Reply({ text }: { text: string }) {
  return (
    <Markdown allowedElements={allowed} unwrapDisallowed skipHtml components={components}>
      {text}
    </Markdown>
  );
}
