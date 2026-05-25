import type { Asset } from '../../shared/types';

interface AssetGridProps {
  assets: Asset[];
  selectedAssetId: string | null;
  loading: boolean;
  onSelectAsset: (assetId: string) => void;
}

export function AssetGrid({ assets, selectedAssetId, loading, onSelectAsset }: AssetGridProps): React.JSX.Element {
  if (!loading && assets.length === 0) {
    return (
      <section className="emptyState">
        <h2>没有匹配的素材</h2>
        <p>导入一个目录，或放宽搜索与标签筛选。</p>
      </section>
    );
  }

  return (
    <section className="assetGridWrap" aria-label="素材列表">
      <div className="resultMeta">
        <strong>{assets.length}</strong>
        <span>个素材</span>
        {loading ? <span className="loadingText">刷新中…</span> : null}
      </div>
      <div className="assetGrid">
        {assets.map((asset) => {
          const thumbnailUrl = getGeneratedFrameThumbnailUrl(asset.thumbnailPath);

          return (
            <button
              className={`assetCard ${asset.id === selectedAssetId ? 'selected' : ''}`}
              key={asset.id}
              type="button"
              onClick={() => onSelectAsset(asset.id)}
            >
              <div className={`kindBadge kind-${asset.kind}`}>{kindLabel(asset.kind)}</div>
              <div className="assetThumb" aria-hidden="true">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <span>{asset.extension.replace('.', '').toUpperCase()}</span>
                )}
              </div>
              <div className="assetCardBody">
                <strong title={asset.fileName}>{asset.fileName}</strong>
                <span title={asset.path}>{asset.path}</span>
              </div>
              <div className="cardFooter">
                <span className={`statusPill status-${asset.status}`}>{statusLabel(asset.status)}</span>
                <span>{formatBytes(asset.sizeBytes)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function getGeneratedFrameThumbnailUrl(thumbnailPath: string | null): string | null {
  if (!thumbnailPath) return null;

  const pathSegments = thumbnailPath.split(/[\\/]+/);
  const framesIndex = pathSegments.lastIndexOf('frames');
  if (framesIndex === -1) return null;

  const frameSegments = pathSegments.slice(framesIndex + 1);
  if (frameSegments.length === 0 || frameSegments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return `/media/frames/${frameSegments.map(encodeURIComponent).join('/')}`;
}

function kindLabel(kind: Asset['kind']): string {
  return {
    image: '图片',
    video: '视频',
    audio: '音频'
  }[kind];
}

function statusLabel(status: Asset['status']): string {
  return {
    pending: '待处理',
    processing: '处理中',
    partial: '部分完成',
    done: '完成',
    failed: '失败',
    skipped: '跳过'
  }[status];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
