export default function SectionCard({ title, description, icon, actions, children, className = "", bodyClassName = "" }) {
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-border-subtle flex flex-col ${className}`}>
      {(title || icon || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            {title && <h2 className="text-headline-sm text-on-surface flex items-center gap-2">{title}</h2>}
            {description && <p className="text-body-sm text-text-muted mt-0.5">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {icon && <span className="material-symbols-outlined text-idm-blue text-[20px]">{icon}</span>}
          </div>
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
