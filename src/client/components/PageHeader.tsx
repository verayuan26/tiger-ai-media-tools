type PageHeaderProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps): React.JSX.Element {
  return (
    <div className="border-b border-border bg-card px-6 py-4 shrink-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
