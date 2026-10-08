export default function Card({ as: Element = "section", className = "", children, ...props }) {
  return (
    <Element className={`surface-card ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
}
