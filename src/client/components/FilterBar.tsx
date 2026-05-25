interface FilterBarProps {
  query: string;
  transcript: string;
  selectedTags: string[];
  busy: boolean;
  onQueryChange: (value: string) => void;
  onTranscriptChange: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onRetryFailed: () => void;
  onDrainJobs: () => void;
}

const starterTags = ['裁剪布料', '缝纫机', '牛仔布', '人物', '产品册', '中文', '英文', '俄文'];

export function FilterBar({
  query,
  transcript,
  selectedTags,
  busy,
  onQueryChange,
  onTranscriptChange,
  onToggleTag,
  onRetryFailed,
  onDrainJobs
}: FilterBarProps): React.JSX.Element {
  return (
    <header className="topbar">
      <div className="searchRow">
        <label className="searchInput">
          <span>搜索</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="文件名、路径、标签"
            type="search"
          />
        </label>
        <label className="searchInput transcriptSearch">
          <span>字幕</span>
          <input
            value={transcript}
            onChange={(event) => onTranscriptChange(event.target.value)}
            placeholder="查找转写文本"
            type="search"
          />
        </label>
        <div className="topbarActions">
          <button className="secondaryButton" type="button" onClick={onRetryFailed} disabled={busy}>
            重试失败
          </button>
          <button className="processButton" type="button" onClick={onDrainJobs} disabled={busy}>
            处理 10 个任务
          </button>
        </div>
      </div>
      <div className="chipRow" aria-label="标签筛选">
        {starterTags.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <button
              className={`tagChip ${selected ? 'selected' : ''}`}
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              aria-pressed={selected}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </header>
  );
}
