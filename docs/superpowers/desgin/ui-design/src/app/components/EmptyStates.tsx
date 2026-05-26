import { FolderOpen, Search, AlertCircle, WifiOff, DollarSign } from 'lucide-react';
import { Button } from './ui/button';

interface EmptyStateProps {
  type: 'empty-library' | 'no-results' | 'file-missing' | 'api-error' | 'disconnected';
  onAction?: () => void;
}

export function EmptyState({ type, onAction }: EmptyStateProps) {
  const configs = {
    'empty-library': {
      icon: FolderOpen,
      title: '开始添加本地目录',
      description: '导入本地素材目录，系统将自动扫描并解析视频、图片和音频文件',
      actionLabel: '添加目录',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    'no-results': {
      icon: Search,
      title: '未找到匹配素材',
      description: '尝试调整搜索关键词或清除筛选条件',
      actionLabel: '清除筛选条件',
      iconColor: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
    'file-missing': {
      icon: AlertCircle,
      title: '文件不可访问',
      description: '原始文件路径不存在，可能已被移动或删除',
      actionLabel: '重新定位',
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    'api-error': {
      icon: DollarSign,
      title: 'API 余额不足',
      description: '云端 API 调用额度已用完，请调整预算或更换 API Key',
      actionLabel: '前往设置',
      iconColor: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    'disconnected': {
      icon: WifiOff,
      title: '移动硬盘已断开',
      description: '请重新连接外置硬盘后点击重试',
      actionLabel: '重新扫描',
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <div className={`inline-flex p-4 rounded-full ${config.bgColor} mb-4`}>
          <Icon className={`size-12 ${config.iconColor}`} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{config.title}</h3>
        <p className="text-sm text-gray-600 mb-6">{config.description}</p>
        {onAction && (
          <Button onClick={onAction} className="bg-[#4a6fa5] hover:bg-[#3d5a8a]">
            {config.actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function FilePathDisplay({ path }: { path: string }) {
  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <p className="text-xs text-gray-500 mb-1">原始路径</p>
      <p className="text-sm font-mono text-gray-900 break-all">{path}</p>
    </div>
  );
}
