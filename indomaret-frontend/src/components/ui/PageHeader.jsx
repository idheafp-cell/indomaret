export default function PageHeader({ breadcrumb, title, description, actions }) {
  return (
    <div className="flex flex-col gap-1.5 pb-4 border-b border-border-subtle/70">
      {breadcrumb && (
        <div className="flex items-center justify-end gap-1.5 text-text-muted text-xs">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1.5">
              {i > 0 && <span className="material-symbols-outlined text-[13px]">chevron_right</span>}
              <span className={i === breadcrumb.length - 1 ? "text-idm-blue font-semibold" : ""}>{crumb}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-on-surface tracking-tight">{title}</h1>
          {description && <p className="text-body-sm text-text-muted mt-0.5 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 self-start md:self-auto">{actions}</div>}
      </div>
    </div>
  );
}
