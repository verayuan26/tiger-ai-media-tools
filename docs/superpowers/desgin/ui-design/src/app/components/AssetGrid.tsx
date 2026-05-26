import { FileVideo, FileImage, FileAudio, Clock, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Asset } from '../types';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface AssetGridProps {
  assets: Asset[];
}

export function AssetGrid({ assets }: AssetGridProps) {
  const navigate = useNavigate();
  if (assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <AlertCircle className="size-12 mx-auto mb-4 opacity-50" />
          <p>未找到匹配的素材</p>
          <p className="text-sm mt-2">尝试调整筛选条件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onClick={() => navigate(`/asset/${asset.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  onClick,
}: {
  asset: Asset;
  onClick: () => void;
}) {
  const getFileIcon = () => {
    switch (asset.fileType) {
      case 'video':
        return <FileVideo className="size-4" />;
      case 'image':
        return <FileImage className="size-4" />;
      case 'audio':
        return <FileAudio className="size-4" />;
    }
  };

  const getStatusBadge = () => {
    switch (asset.status) {
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
          <Badge className="absolute top-2 right-2 bg-amber-600 text-white">
            部分完成
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <button
      onClick={onClick}
      className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-all hover:shadow-lg"
    >
      <div className="aspect-video relative overflow-hidden bg-muted">
        <img
          src={asset.thumbnailUrl}
          alt={asset.fileName}
          className="size-full object-cover group-hover:scale-105 transition-transform"
        />
        {asset.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(asset.duration)}
          </div>
        )}
        {getStatusBadge()}
      </div>

      <div className="p-3 text-left bg-card">
        <div className="flex items-start gap-2 mb-2">
          {getFileIcon()}
          <p className="text-sm font-medium truncate flex-1">{asset.fileName}</p>
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          {asset.tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id} variant="outline" className="text-xs">
              {tag.name}
            </Badge>
          ))}
          {asset.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{asset.tags.length - 3}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{formatFileSize(asset.size)}</p>
      </div>
    </button>
  );
}
