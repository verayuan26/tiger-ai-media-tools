import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  FileAudio,
  FileImage,
  FileVideo,
  FolderOpen,
  HardDrive,
  RefreshCw,
  Zap
} from 'lucide-react';
import { ApiError, getAssetDetail, type AssetDetailResponse } from '../api';
import { getAssetThumbnailUrl, getGeneratedFrameThumbnailUrl } from '../lib/media-url';
import type { Asset, MediaKind } from '../../shared/types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';

export function AssetDetailPage(): React.JSX.Element {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AssetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assetId) {
      setDetail(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    getAssetDetail(assetId)
      .then((response) => {
        if (active) setDetail(response);
      })
      .catch((error: unknown) => {
        if (active) {
          setDetail(null);
          toast.error(readErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [assetId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white text-muted-foreground">
        加载素材详情…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-600">素材不存在</p>
          <Button type="button" onClick={() => navigate('/')} className="mt-4">
            返回素材库
          </Button>
        </div>
      </div>
    );
  }

  const { asset, tags, frames, transcripts } = detail;
  const previewUrl = getAssetThumbnailUrl(asset.id, asset.thumbnailPath);

  return (
    <div className="flex-1 flex flex-col h-full bg-white min-h-0">
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" type="button" onClick={() => navigate('/')}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileKindIcon kind={asset.kind} />
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-lg text-gray-900 truncate">{asset.fileName}</h1>
              <p className="text-sm text-gray-600 truncate">{asset.path}</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="rounded-lg overflow-hidden bg-gray-100">
            <div className="aspect-video flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={asset.fileName}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-muted-foreground">{asset.extension.replace('.', '').toUpperCase()}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="border rounded-lg p-6">
                <h2 className="font-semibold text-gray-900 mb-4">文件信息</h2>
                <div className="space-y-3">
                  <InfoRow icon={HardDrive} label="大小" value={formatFileSize(asset.sizeBytes)} />
                  {asset.durationSeconds ? (
                    <InfoRow icon={Clock} label="时长" value={formatDuration(asset.durationSeconds)} />
                  ) : null}
                  <InfoRow icon={Calendar} label="创建时间" value={formatDate(asset.createdAt)} />
                  <InfoRow icon={Calendar} label="修改时间" value={formatDate(asset.modifiedAt)} />
                </div>
              </div>

              <div className="border rounded-lg p-6">
                <h2 className="font-semibold text-gray-900 mb-4">标签</h2>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={`${tag.source}:${tag.displayName}`}
                        variant={
                          tag.source === 'ai' ? 'default' : tag.source === 'user' ? 'secondary' : 'outline'
                        }
                        className="text-sm"
                      >
                        {tag.displayName}
                        {tag.confidence ? (
                          <span className="ml-1 text-xs opacity-70">{Math.round(tag.confidence * 100)}%</span>
                        ) : null}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">暂无标签</p>
                )}
                <p className="text-xs text-gray-500 mt-4">AI 标签可能不完全准确，支持手动修正</p>
              </div>

              {asset.kind === 'video' ? (
                <div className="border rounded-lg p-6">
                  <Tabs defaultValue="frames" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="frames" className="flex-1">
                        关键帧 {frames.length}
                      </TabsTrigger>
                      <TabsTrigger value="transcripts" className="flex-1">
                        字幕 {transcripts.length}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="frames" className="space-y-4">
                      {frames.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {frames.map((frame) => {
                            const frameThumb = getGeneratedFrameThumbnailUrl(frame.thumbnailPath);
                            return (
                              <div key={frame.id} className="border rounded-lg overflow-hidden">
                                <div className="aspect-video bg-gray-100">
                                  {frameThumb ? (
                                    <img
                                      src={frameThumb}
                                      alt=""
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <div className="size-full flex items-center justify-center text-xs text-muted-foreground">
                                      无预览
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-900">
                                      {formatDuration(frame.timestampSeconds)}
                                    </span>
                                  </div>
                                  {frame.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {frame.tags.map((tag) => (
                                        <Badge
                                          key={tag.displayName}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {tag.displayName}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">{frame.strategy}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-8">暂无关键帧数据</p>
                      )}
                    </TabsContent>

                    <TabsContent value="transcripts" className="space-y-3">
                      {transcripts.length > 0 ? (
                        transcripts.map((segment) => (
                          <div key={segment.id} className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                {languageLabel(segment.language)}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {formatDuration(segment.startSeconds)} - {formatDuration(segment.endSeconds)}
                              </span>
                            </div>
                            <p className="text-sm mb-2 text-gray-900">{segment.text}</p>
                            {segment.translation ? (
                              <p className="text-sm text-gray-600 italic">翻译: {segment.translation}</p>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-8">暂无字幕数据</p>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <h2 className="font-semibold text-gray-900">操作</h2>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full justify-start"
                  onClick={() => void copyPath(asset.path)}
                >
                  <Copy className="size-4 mr-2" />
                  复制路径
                </Button>
                <Button variant="outline" type="button" className="w-full justify-start" disabled>
                  <FolderOpen className="size-4 mr-2" />
                  在文件夹中显示
                </Button>
                <Button variant="outline" type="button" className="w-full justify-start" disabled>
                  <RefreshCw className="size-4 mr-2" />
                  重新解析
                </Button>
                <Separator />
                <Button
                  variant="outline"
                  type="button"
                  className="w-full justify-start border-amber-300 text-amber-700 hover:bg-amber-50"
                  disabled
                >
                  <Zap className="size-4 mr-2" />
                  <span className="flex-1 text-left">开启精查模式</span>
                </Button>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">每 3 秒抽一帧，可能增加云端调用成本</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function FileKindIcon({ kind }: { kind: MediaKind }): React.JSX.Element {
  switch (kind) {
    case 'video':
      return <FileVideo className="size-6" />;
    case 'image':
      return <FileImage className="size-6" />;
    case 'audio':
      return <FileAudio className="size-6" />;
  }
}

function InfoRow({
  icon: Icon,
  label,
  value
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="size-4 text-gray-400 shrink-0" />
      <span className="text-gray-600 w-20 shrink-0">{label}:</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

async function copyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    toast.success('路径已复制');
  } catch {
    toast.error('无法复制路径');
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function languageLabel(language: string): string {
  if (language === 'ru') return '俄文';
  if (language === 'en') return '英文';
  if (language === 'zh') return '中文';
  return language;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '加载失败，请稍后重试。';
}
