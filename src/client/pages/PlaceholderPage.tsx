type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps): React.JSX.Element {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-background">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
