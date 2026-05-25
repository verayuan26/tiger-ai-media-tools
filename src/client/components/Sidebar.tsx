import type { FormEvent } from 'react';
import type { LibrarySource } from '../../shared/types';

interface SidebarProps {
  sources: LibrarySource[];
  rootPath: string;
  sourceName: string;
  busy: boolean;
  onRootPathChange: (value: string) => void;
  onSourceNameChange: (value: string) => void;
  onImport: () => void;
}

const themes = ['牛仔面料工厂'];

export function Sidebar({
  sources,
  rootPath,
  sourceName,
  busy,
  onRootPathChange,
  onSourceNameChange,
  onImport
}: SidebarProps): React.JSX.Element {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onImport();
  }

  return (
    <aside className="sidebar" aria-label="素材库导航">
      <div className="brandBlock">
        <p className="eyebrow">Local Library</p>
        <h1>AI 素材库</h1>
      </div>

      <section className="sideSection" aria-labelledby="theme-heading">
        <h2 id="theme-heading">主题</h2>
        <ul className="themeList">
          {themes.map((theme) => (
            <li key={theme}>
              <button className="themeButton active" type="button">
                <span className="themeSwatch" aria-hidden="true" />
                {theme}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="sideSection" aria-labelledby="source-heading">
        <div className="sectionHeader">
          <h2 id="source-heading">来源</h2>
          <span className="countBadge">{sources.length}</span>
        </div>
        {sources.length > 0 ? (
          <ul className="sourceList">
            {sources.map((source) => (
              <li key={source.id} className="sourceItem">
                <strong>{source.name}</strong>
                <span title={source.rootPath}>{source.rootPath}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mutedText">还没有导入目录。</p>
        )}
      </section>

      <form className="importForm" onSubmit={handleSubmit}>
        <h2>导入目录</h2>
        <label>
          <span>名称</span>
          <input
            value={sourceName}
            onChange={(event) => onSourceNameChange(event.target.value)}
            placeholder="如：工厂样片"
          />
        </label>
        <label>
          <span>本地路径</span>
          <input
            value={rootPath}
            onChange={(event) => onRootPathChange(event.target.value)}
            placeholder="/Users/me/media"
          />
        </label>
        <button className="primaryButton" type="submit" disabled={busy || !rootPath.trim() || !sourceName.trim()}>
          {busy ? '导入中...' : '导入'}
        </button>
      </form>
    </aside>
  );
}
