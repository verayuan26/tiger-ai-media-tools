import { AlertCircle, Clock, FileAudio, FileImage, FileVideo, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import type { AssetListItem, MediaKind } from '../../../shared/types';
import {
  libraryScrollStorageKey,
  readLibraryScroll,
  saveLibraryScroll
} from '../../lib/library-scroll';
import { getAssetThumbnailUrl } from '../../lib/media-url';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface LibraryAssetGridProps {
  assets: AssetListItem[];
  loading: boolean;
  scrollStorageKey: string;
}

export function LibraryAssetGrid({
  assets,
  loading,
  scrollStorageKey
}: LibraryAssetGridProps): React.JSX.Element {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);
  const sessionKey = libraryScrollStorageKey(scrollStorageKey);

  useEffect(() => {
    scrollRestoredRef.current = false;
  }, [sessionKey]);

  useLayoutEffect(() => {
    if (loading || assets.length === 0 || scrollRestoredRef.current) return;

    const container = scrollRef.current;
    if (!container) return;

    const savedScrollTop = readLibraryScroll(sessionKey);
    if (savedScrollTop <= 0) {
      scrollRestoredRef.current = true;
      return;
    }

    const restore = (): void => {
      container.scrollTop = savedScrollTop;
    };

    restore();
    requestAnimationFrame(() => {
      restore();
      scrollRestoredRef.current = true;
    });
  }, [assets.length, loading, sessionKey]);

  const persistScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    saveLibraryScroll(sessionKey, container.scrollTop);
  }, [sessionKey]);

  const openAsset = useCallback(
    (assetId: string) => {
      persistScroll();
      navigate(`/asset/${assetId}`);
    },
    [navigate, persistScroll]
  );

  if (loading && assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" aria-label="加载中" />
      </div>
    );
  }

  if (!loading && assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <AlertCircle className="size-12 mx-auto mb-4 opacity-50" />
          <p>未找到匹配的素材</p>
          <p className="text-sm mt-2">尝试调整筛选条件，或在「导入来源」添加目录</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto p-4 bg-background"
      onScroll={persistScroll}
    >
      {loading ? (
        <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          刷新中…
        </p>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onClick={() => openAsset(asset.id)} />
        ))}
      </div>
    </div>
  );
}

function AssetCard({ asset, onClick }: { asset: AssetListItem; onClick: () => void }): React.JSX.Element {
  const thumbnailUrl = getAssetThumbnailUrl(asset.id, asset.thumbnailPath);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative rounded-lg overflow-hidden border border-border bg-card',
        'hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-black/40 text-left w-full'
      )}
    >
      <div className="aspect-video relative overflow-hidden bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="size-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="size-full flex items-center justify-center text-muted-foreground text-sm font-medium">
            {asset.extension.replace('.', '').toUpperCase()}
          </div>
        )}
        {asset.durationSeconds ? (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(asset.durationSeconds)}
          </div>
        ) : null}
        <StatusBadge status={asset.status} />
      </div>

      <div className="p-3 bg-card">
        <div className="flex items-start gap-2 mb-2">
          <FileKindIcon kind={asset.kind} />
          <p className="text-sm font-medium truncate flex-1" title={asset.fileName}>
            {asset.fileName}
          </p>
        </div>
        {asset.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-2">
            {asset.tags.map((tag) => (
              <Badge key={tag.displayName} variant="outline" className="text-xs">
                {tag.displayName}
              </Badge>
            ))}
            {asset.tagCount > asset.tags.length ? (
              <Badge variant="outline" className="text-xs">
                +{asset.tagCount - asset.tags.length}
              </Badge>
            ) : null}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{formatFileSize(asset.sizeBytes)}</p>
      </div>
    </button>
  );
}

function FileKindIcon({ kind }: { kind: MediaKind }): React.JSX.Element {
  switch (kind) {
    case 'video':
      return <FileVideo className="size-4 shrink-0 text-muted-foreground" />;
    case 'image':
      return <FileImage className="size-4 shrink-0 text-muted-foreground" />;
    case 'audio':
      return <FileAudio className="size-4 shrink-0 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: AssetListItem['status'] }): React.JSX.Element | null {
  switch (status) {
    case 'processing':
      return (
        <Badge className="absolute top-2 right-2 bg-blue-600 text-white">
          <Loader2 className="size-3 mr-1 animate-spin" />
          处理中
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="absolute top-2 right-2 bg-red-600 text-white">
          <AlertCircle className="size-3 mr-1" />
          失败
        </Badge>
      );
    case 'partial':
      return (
        <Badge className="absolute top-2 right-2 bg-amber-600 text-white">部分完成</Badge>
      );
    default:
      return null;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}
